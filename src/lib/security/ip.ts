import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Client IP from proxy headers. In production the app runs behind our own
 * reverse proxy (Caddy), which overwrites X-Forwarded-For with the real peer
 * address, so the first entry is trustworthy there.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

/**
 * Keyed, daily-rotating hash of an IP (DSGVO: the raw address is never stored
 * and hashes cannot be linked across days). 128 bits, hex.
 */
export function hashIp(ip: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", serverEnv().IP_HASH_SECRET).update(`${day}|${ip}`).digest("hex").slice(0, 32);
}
