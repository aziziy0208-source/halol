import { z } from "zod";

/**
 * APP_URL, or on Vercel the project's production domain while APP_URL is not set yet
 * (set APP_URL to the final domain before issuing real certificates: QR codes keep it).
 */
export function configuredAppUrl(): string | undefined {
  if (process.env.APP_URL) return process.env.APP_URL;
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelDomain ? `https://${vercelDomain}` : undefined;
}

/** Empty strings in .env count as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

/**
 * Server-side environment, validated on first use (not at import time, so
 * `next build` works without a database). Later stages add S3/auth keys.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Public base URL used in QR links, e.g. https://halal-zertifizierung.org
  APP_URL: z.preprocess(() => configuredAppUrl(), z.url({ protocol: /^https?$/ })),
  // Key for hashing IP addresses (rate limits, logs). Never store raw IPs.
  IP_HASH_SECRET: z.string().min(32),
  // AES-256-GCM key (32 bytes as 64 hex chars) that encrypts TOTP secrets at rest.
  TOTP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "must be 64 hex characters (32 bytes)"),

  // Private file storage (certificate PDFs, signatures, stamps).
  // "s3" = S3-compatible (Garage in docker-compose); "fs" = local directory (dev/tests);
  // "vercel-blob" = private Vercel Blob store (default on Vercel, needs BLOB_READ_WRITE_TOKEN).
  STORAGE_DRIVER: z.preprocess(
    (v) => (v === "" || v === undefined ? (process.env.VERCEL ? "vercel-blob" : undefined) : v),
    z.enum(["s3", "fs", "vercel-blob"]).default("s3"),
  ),
  BLOB_READ_WRITE_TOKEN: optional(z.string()),
  STORAGE_DIR: z.string().default(".data/storage"),
  S3_ENDPOINT: optional(z.url()),
  S3_REGION: z.string().default("garage"),
  S3_BUCKET: z.string().default("whu-files"),
  S3_ACCESS_KEY_ID: optional(z.string()),
  S3_SECRET_ACCESS_KEY: optional(z.string()),

  // Contact form e-mail. Without SMTP_HOST messages are only stored in the DB.
  SMTP_HOST: optional(z.string()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  SMTP_USER: optional(z.string()),
  SMTP_PASSWORD: optional(z.string()),
  SMTP_FROM: optional(z.string()),
  CONTACT_TO_EMAIL: z.email().default("info@halal-zertifizierung.org"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Public site URL for metadata, sitemap and robots (safe at build time). */
export function siteUrl(): string {
  return (configuredAppUrl() || "https://halal-zertifizierung.org").replace(/\/$/, "");
}
