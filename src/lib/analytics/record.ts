import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { clientIp } from "@/lib/security/ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { BOT_USER_AGENT, classifySource, parseUserAgent, primaryLanguage } from "./classify";

const SALT_KEY = "analytics.salt";
const MAX_VIEWS_PER_HOUR = 300; // per visitor: stops scripted flooding of the statistics

let saltCache: { day: string; salt: string } | undefined;

/**
 * Random salt for today's visitor hashes. A new one replaces it every day (UTC), so the
 * same person gets an unrelated hash tomorrow and yesterday's hashes can no longer be
 * recomputed — not even by us (DSGVO: anonymous counting without cookies).
 */
async function dailySalt(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  if (saltCache?.day === day) return saltCache.salt;
  const stored = await prisma.setting.findUnique({ where: { key: SALT_KEY } });
  const value = stored?.value as { day?: string; salt?: string } | null;
  if (value?.day === day && value.salt) {
    saltCache = { day, salt: value.salt };
    return value.salt;
  }
  const salt = randomBytes(32).toString("hex");
  // Two instances may roll the salt at the same moment: the conditional update lets only one win.
  if (stored) {
    await prisma.setting.updateMany({ where: { key: SALT_KEY, value: { equals: stored.value as never } }, data: { value: { day, salt } } });
  } else {
    await prisma.setting.createMany({ data: [{ key: SALT_KEY, value: { day, salt } }], skipDuplicates: true });
  }
  const current = (await prisma.setting.findUniqueOrThrow({ where: { key: SALT_KEY } })).value as { day: string; salt: string };
  saltCache = current.day === day ? current : undefined;
  return current.salt;
}

export type BeaconPayload = { p?: unknown; q?: unknown; r?: unknown; w?: unknown };

/** "/v/Ab3d…" → "/v/*": verification pages are counted together (and the token is not kept). */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > 300) return null;
  let path = raw.split(/[?#]/)[0] ?? "/";
  try {
    path = decodeURI(path);
  } catch {
    return null;
  }
  if (/^\/(admin|api|_next)(\/|$)/.test(path)) return null;
  if (path.startsWith("/v/")) return "/v/*";
  if (!/^\/[\w\-./~äöüß]*$/i.test(path)) return null;
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

function header(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

/**
 * Stores one page view. Returns false when the request is not counted (bot, "Global
 * Privacy Control" signal, invalid data, flooding).
 */
export async function recordPageView(payload: BeaconPayload, headers: Headers): Promise<boolean> {
  const userAgent = headers.get("user-agent") ?? "";
  if (!userAgent || BOT_USER_AGENT.test(userAgent)) return false;
  if (headers.get("sec-gpc") === "1") return false; // visitor asked not to be tracked
  const path = normalizePath(payload.p);
  if (!path) return false;

  const salt = await dailySalt();
  const visitorHash = createHash("sha256").update(`${salt}|${clientIp(headers)}|${userAgent}`).digest("hex").slice(0, 32);
  if (!(await consumeRateLimit(`pv:${visitorHash}`, MAX_VIEWS_PER_HOUR, 3600)).allowed) return false;

  const query = new URLSearchParams(typeof payload.q === "string" ? payload.q.slice(0, 500) : "");
  const utm = (name: string) => query.get(name)?.trim().slice(0, 80) || null;
  const ownHosts = [new URL(siteUrl()).hostname.replace(/^www\./, ""), (headers.get("host") ?? "").split(":")[0]!.replace(/^www\./, "")];
  const referrer = typeof payload.r === "string" ? payload.r.slice(0, 500) : null;
  const { source, sourceName, referrerHost } = classifySource(referrer, ownHosts, { source: utm("utm_source") });
  const { device, browser, os } = parseUserAgent(userAgent);
  const width = typeof payload.w === "number" && Number.isFinite(payload.w) ? Math.round(payload.w) : null;
  const country = headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? headers.get("x-country-code");

  await prisma.pageView.create({
    data: {
      path,
      siteLang: path === "/en" || path.startsWith("/en/") ? "en" : path === "/v/*" ? null : "de",
      source,
      sourceName,
      referrerHost,
      utmSource: utm("utm_source"),
      utmMedium: utm("utm_medium"),
      utmCampaign: utm("utm_campaign"),
      country: country && /^[A-Z]{2}$/i.test(country) && !/^(XX|T1)$/i.test(country) ? country.toUpperCase() : null,
      region: header(headers, "x-vercel-ip-country-region"),
      city: header(headers, "x-vercel-ip-city"),
      device,
      browser,
      os,
      language: primaryLanguage(headers.get("accept-language")),
      screenWidth: width && width > 0 && width < 10000 ? width : null,
      visitorHash,
    },
  });
  return true;
}

/** Statistics are kept 25 months (year-over-year comparison), then deleted. */
export async function prunePageViews(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 25);
  return (await prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
}
