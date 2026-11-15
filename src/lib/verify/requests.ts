import "server-only";
import type { ScanChannel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/security/ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/** Per-IP limits of the public verification endpoints (spec §8.2: 30 page views per minute). */
const LIMITS = {
  page: { limit: 30, windowSeconds: 60 },
  file: { limit: 30, windowSeconds: 60 },
  manual: { limit: 10, windowSeconds: 600 },
  challenge: { limit: 30, windowSeconds: 600 },
} as const;

export type LimitKind = keyof typeof LIMITS;

export function requestIpHash(headers: Headers): string {
  return hashIp(clientIp(headers));
}

export async function withinLimit(kind: LimitKind, headers: Headers): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[kind];
  return (await consumeRateLimit(`verify-${kind}:${requestIpHash(headers)}`, limit, windowSeconds)).allowed;
}

// Link-preview fetchers and crawlers are not people checking a certificate.
const BOT_UA = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|skype|preview|curl\/|wget\/|python-|okhttp|go-http-client/i;
const DEDUP_SECONDS = 60;

function isPrefetch(headers: Headers): boolean {
  return (
    headers.has("next-router-prefetch") ||
    headers.get("purpose") === "prefetch" ||
    (headers.get("sec-purpose") ?? "").includes("prefetch")
  );
}

/** Approximate country from the reverse proxy / CDN (never derived from a stored IP). */
function country(headers: Headers): string | null {
  for (const name of ["x-country-code", "cf-ipcountry", "x-vercel-ip-country"]) {
    const value = headers.get(name)?.trim().toUpperCase();
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") return value;
  }
  return null;
}

/**
 * ScanLog entry for a verification (spec §6, §8.2). DSGVO: no IP address — only
 * a daily-rotating keyed hash, the user agent (truncated) and an approximate country.
 * Reloads by the same visitor within a minute, prefetches and bots are not counted.
 */
export async function recordScan(certificateId: string, channel: ScanChannel, headers: Headers): Promise<void> {
  const userAgent = headers.get("user-agent") ?? "";
  if (isPrefetch(headers) || BOT_UA.test(userAgent)) return;
  const ipHash = requestIpHash(headers);
  const recent = await prisma.scanLog.findFirst({
    where: { certificateId, ipHash, scannedAt: { gte: new Date(Date.now() - DEDUP_SECONDS * 1000) } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.scanLog.create({
    data: { certificateId, channel, ipHash, country: country(headers), userAgent: userAgent.slice(0, 200) || null },
  });
}
