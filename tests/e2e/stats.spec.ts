import { test } from "@playwright/test";
import { check, database, SA } from "./helpers";
import { e2eEnvironment } from "./environment";

const env = e2eEnvironment("stats", 3209, { REQUIRE_2FA: "false" });
const BASE = env.base;

// Real browser user agents: headless/automation agents are filtered out as bots.
const WIN_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("statistics: anonymous page views, sources, geo, devices, bots and GPC excluded, admin report", async ({ browser }) => {
  const { q, one, waitDb, end } = await database(env.databaseUrl);
  const visit = async (ua: string, headers: Record<string, string>, steps: [string, string?][]) => {
    const ctx = await browser.newContext({ userAgent: ua, extraHTTPHeaders: headers, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    for (const [path, referer] of steps) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", ...(referer ? { referer } : {}) });
      await page.waitForTimeout(300);
    }
    await ctx.close();
  };

  // Visitor A (Munich, desktop, from Google) opens two pages.
  await visit(WIN_CHROME, { "x-vercel-ip-country": "DE", "x-vercel-ip-city": "M%C3%BCnchen", "accept-language": "de-DE,de;q=0.9" }, [
    ["/", "https://www.google.com/"],
    ["/impressum", `${BASE}/`],
  ]);
  // Visitor B (Tashkent, iPhone, from Telegram) on the English site.
  await visit(IPHONE, { "x-vercel-ip-country": "UZ", "x-vercel-ip-city": "Tashkent", "accept-language": "uz-UZ,uz;q=0.9" }, [
    ["/en", "https://t.me/"],
  ]);
  // Visitor C: campaign link, then a QR verification page.
  await visit(ANDROID, { "accept-language": "en-GB,en;q=0.8" }, [
    ["/en?utm_source=newsletter&utm_medium=email&utm_campaign=launch", "https://mail.google.com/"],
    ["/v/AAAAAAAAAAAAAAAA"],
  ]);
  // Not counted: a search engine robot and a visitor with Global Privacy Control.
  await visit("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", {}, [["/"]]);
  await visit(WIN_CHROME.replace("142", "141"), { "sec-gpc": "1" }, [["/"]]);

  const rows = await waitDb(`SELECT * FROM "PageView" ORDER BY "createdAt"`, [], (r) => r.length >= 5, 20_000);
  check(rows.length === 5, `5 page views stored (got ${rows.length}); robot and GPC visitor ignored`);
  const a = rows.find((r) => r.path === "/");
  check(a?.source === "search" && a?.sourceName === "Google" && a?.country === "DE" && a?.city === "München" && a?.device === "desktop" && a?.os === "Windows" && a?.language === "de", "visitor A: Google, Munich, desktop, Windows, de");
  const b = rows.find((r) => r.siteLang === "en" && r.os === "iOS");
  check(b?.source === "social" && b?.sourceName === "Telegram" && b?.device === "mobile" && b?.browser === "Safari" && b?.language === "uz", "visitor B: Telegram, iPhone Safari, uz");
  const c = rows.find((r) => r.utmCampaign === "launch");
  check(c?.source === "campaign" && c?.utmSource === "newsletter" && c?.os === "Android", "visitor C: UTM campaign wins over the referrer");
  check(rows.some((r) => r.path === "/v/*") && !rows.some((r) => String(r.path).includes("AAAA")), "verification pages stored as /v/* (no token)");
  check(new Set(rows.map((r) => r.visitorHash)).size === 3, "3 distinct visitors");
  check(rows.every((r) => !JSON.stringify(r).includes("127.0.0.1")), "no IP address stored");
  check((await one(`SELECT value FROM "Setting" WHERE key='analytics.salt'`))?.value?.salt?.length === 64, "daily random salt stored");

  // Invalid beacons are rejected or ignored.
  const api = await browser.newContext({ userAgent: WIN_CHROME });
  check((await api.request.post(`${BASE}/api/collect`, { data: "x".repeat(3000) })).status() === 413, "oversized beacon rejected");
  await api.request.post(`${BASE}/api/collect`, { data: { p: "/admin/users" } });
  await api.close();

  // ── Admin report ──
  const page = await browser.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", SA.email);
  await page.fill("#password", SA.password);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click('button[type="submit"]')]);
  await page.goto(`${BASE}/admin/statistics?range=7`);
  await page.getByRole("heading", { name: "Traffic sources" }).waitFor();
  const text = await page.locator("main").innerText();
  for (const expected of ["Google", "Telegram", "newsletter / email / launch", "Germany", "Uzbekistan", "München", "Mobile", "Desktop", "iOS", "Windows", "Uzbek (uz)", "/impressum"]) {
    check(text.includes(expected), `report shows "${expected}"`);
  }
  check(/visitors\s*3\b/i.test(text), "3 visitors in the KPI");
  check((await page.locator('nav a[href="/admin/statistics"]').count()) === 1, "Statistics in the admin menu");
  if (process.env.STATS_SCREENSHOT) await page.screenshot({ path: process.env.STATS_SCREENSHOT, fullPage: true });
  check((await q(`SELECT 1 FROM "PageView" WHERE path LIKE '/admin%'`)).length === 0, "admin paths never stored");
  await end();
});
