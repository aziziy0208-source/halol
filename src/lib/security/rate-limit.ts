import "server-only";
import { prisma } from "@/lib/db";

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window counter in Postgres (one atomic upsert per call), so limits
 * hold across restarts and parallel requests.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  // Prisma stores DateTime as UTC in "timestamp without time zone" columns, so the
  // SQL uses UTC explicitly too — independent of the database session's TimeZone.
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1
                     ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt"
                       ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (!row) throw new Error("rate limit upsert returned no row");

  // Opportunistic cleanup of expired buckets (~1% of calls).
  if (Math.random() < 0.01) {
    await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  }

  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}
