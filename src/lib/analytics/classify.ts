/**
 * Pure helpers for the first-party statistics: where a visit came from and on what
 * kind of device. Only public request data is used (referrer, UTM parameters,
 * user agent, Accept-Language) — nothing is read from or stored on the device.
 */

export type Source = "direct" | "search" | "social" | "ai" | "email" | "referral" | "campaign";

type Rule = { name: string; source: Source; hosts: RegExp };

// Order matters: the first match wins (e.g. Google Gemini before Google search).
const RULES: Rule[] = [
  { name: "ChatGPT", source: "ai", hosts: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/ },
  { name: "Perplexity", source: "ai", hosts: /(^|\.)perplexity\.ai$/ },
  { name: "Claude", source: "ai", hosts: /(^|\.)claude\.ai$/ },
  { name: "Gemini", source: "ai", hosts: /^gemini\.google\.com$/ },
  { name: "Copilot", source: "ai", hosts: /^copilot\.microsoft\.com$/ },
  { name: "DeepSeek", source: "ai", hosts: /(^|\.)deepseek\.com$/ },
  { name: "Gmail", source: "email", hosts: /^mail\.google\.com$/ },
  { name: "Outlook", source: "email", hosts: /(^|\.)(outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com)$/ },
  { name: "Yahoo Mail", source: "email", hosts: /^mail\.yahoo\.com$/ },
  { name: "Mail.ru", source: "email", hosts: /^e\.mail\.ru$/ },
  { name: "Google", source: "search", hosts: /(^|\.)google\.[a-z.]{2,6}$/ },
  { name: "Bing", source: "search", hosts: /(^|\.)bing\.com$/ },
  { name: "Yandex", source: "search", hosts: /(^|\.)(yandex\.[a-z.]{2,6}|ya\.ru)$/ },
  { name: "DuckDuckGo", source: "search", hosts: /(^|\.)duckduckgo\.com$/ },
  { name: "Yahoo", source: "search", hosts: /(^|\.)yahoo\.(com|co\.[a-z]{2}|[a-z]{2})$/ },
  { name: "Baidu", source: "search", hosts: /(^|\.)baidu\.com$/ },
  { name: "Ecosia", source: "search", hosts: /(^|\.)ecosia\.org$/ },
  { name: "Qwant", source: "search", hosts: /(^|\.)qwant\.com$/ },
  { name: "Brave Search", source: "search", hosts: /^search\.brave\.com$/ },
  { name: "Startpage", source: "search", hosts: /(^|\.)startpage\.com$/ },
  { name: "Naver", source: "search", hosts: /(^|\.)naver\.com$/ },
  { name: "Seznam", source: "search", hosts: /(^|\.)seznam\.cz$/ },
  { name: "Mail.ru Search", source: "search", hosts: /^go\.mail\.ru$/ },
  { name: "Telegram", source: "social", hosts: /(^|\.)(t\.me|telegram\.org|telegram\.me)$/ },
  { name: "Facebook", source: "social", hosts: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/ },
  { name: "Instagram", source: "social", hosts: /(^|\.)instagram\.com$/ },
  { name: "LinkedIn", source: "social", hosts: /(^|\.)(linkedin\.com|lnkd\.in)$/ },
  { name: "X (Twitter)", source: "social", hosts: /(^|\.)(x\.com|twitter\.com|t\.co)$/ },
  { name: "YouTube", source: "social", hosts: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { name: "WhatsApp", source: "social", hosts: /(^|\.)(whatsapp\.com|wa\.me)$/ },
  { name: "TikTok", source: "social", hosts: /(^|\.)tiktok\.com$/ },
  { name: "VK", source: "social", hosts: /(^|\.)(vk\.com|vk\.ru)$/ },
  { name: "Odnoklassniki", source: "social", hosts: /(^|\.)ok\.ru$/ },
  { name: "Pinterest", source: "social", hosts: /(^|\.)pinterest\.[a-z.]{2,6}$/ },
  { name: "Reddit", source: "social", hosts: /(^|\.)reddit\.com$/ },
];

export type Classified = { source: Source; sourceName: string | null; referrerHost: string | null };

/** Normalised host of a referrer URL ("www." dropped), or null. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "").slice(0, 120) || null;
  } catch {
    return null;
  }
}

/**
 * UTM parameters win (campaign links); otherwise the referrer decides. Referrers from
 * our own site count as "direct" (an internal click is not a new source); the
 * Android app referrer "android-app://org.telegram.messenger" etc. is recognised too.
 */
export function classifySource(
  referrer: string | null | undefined,
  ownHosts: string[],
  utm: { source?: string | null } = {},
): Classified {
  if (utm.source) return { source: "campaign", sourceName: utm.source.slice(0, 80), referrerHost: referrerHost(referrer) };
  if (referrer?.startsWith("android-app://")) {
    const app = referrer.slice("android-app://".length).split("/")[0] ?? "";
    if (app.includes("telegram")) return { source: "social", sourceName: "Telegram", referrerHost: null };
    if (app.includes("googlequicksearchbox")) return { source: "search", sourceName: "Google", referrerHost: null };
    if (app.includes("gm")) return { source: "email", sourceName: "Gmail", referrerHost: null };
    return { source: "referral", sourceName: app.slice(0, 80) || null, referrerHost: null };
  }
  const host = referrerHost(referrer);
  if (!host || ownHosts.includes(host)) return { source: "direct", sourceName: null, referrerHost: null };
  const rule = RULES.find((r) => r.hosts.test(host));
  if (rule) return { source: rule.source, sourceName: rule.name, referrerHost: host };
  return { source: "referral", sourceName: host, referrerHost: host };
}

/** Crawlers, previews, monitoring and headless automation — not counted as visitors. */
export const BOT_USER_AGENT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|preview|monitor|uptime|lighthouse|pagespeed|headless|phantomjs|selenium|puppeteer|playwright|python-requests|curl\/|wget|httpclient|okhttp|axios|node-fetch|go-http-client|java\//i;

export type Device = "mobile" | "tablet" | "desktop";

export function parseUserAgent(ua: string): { device: Device; browser: string | null; os: string | null } {
  const device: Device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)
    ? "tablet"
    : /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)
      ? "mobile"
      : "desktop";
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /YaBrowser\//.test(ua)
        ? "Yandex Browser"
        : /SamsungBrowser\//.test(ua)
          ? "Samsung Internet"
          : /Firefox\/|FxiOS\//.test(ua)
            ? "Firefox"
            : /Chrome\/|CriOS\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : null;
  const os = /Windows NT/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "ChromeOS"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return { device, browser, os };
}

/** First language of Accept-Language, primary subtag only ("de-DE,de;q=0.9" → "de"). */
export function primaryLanguage(acceptLanguage: string | null): string | null {
  const tag = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim().toLowerCase().split("-")[0];
  return tag && /^[a-z]{2,3}$/.test(tag) ? tag : null;
}
