import { test } from "@playwright/test";
import { check, database } from "./helpers";
import { e2eEnvironment } from "./environment";

const env = e2eEnvironment("site-en", 3207);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("English site: /en pages, language switch, localized links, contact form, SEO", async ({ browser }) => {
  const { q, end } = await database(env.databaseUrl);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ── English home ──
  const res = await page.goto(`${BASE}/en`, { waitUntil: "networkidle" });
  check(res?.status() === 200, "/en answers 200");
  check((await page.evaluate(() => document.documentElement.lang)) === "en", "document language switched to en");
  check((await page.locator("h1").innerText()).includes("Halal certification"), "English h1");
  const nav = page.locator('header nav[aria-label="Main navigation"]').first();
  check((await nav.innerText()).includes("ABOUT US"), "English menu labels");
  check((await nav.locator('a[href="#about"]').count()) === 1, "home menu anchors stay in-page");
  check((await nav.locator('a[href="/en/verify-certificate"]').count()) === 1, "menu links to the English certificate check");
  check((await page.locator('header a[hreflang="de"]').first().getAttribute("href")) === "/", "language switch → German home");
  check((await page.locator('footer a[href="/en/imprint"]').count()) === 1, "footer links to the English legal notice");
  check(/^https?:\/\/[^/]+\/?$/.test((await page.locator('link[rel="alternate"][hreflang="de"]').getAttribute("href")) ?? ""), "hreflang de alternate → German home");
  check(((await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute("href")) ?? "").endsWith("/en"), "hreflang en alternate");
  check((await page.locator('link[rel="canonical"]').getAttribute("href"))?.endsWith("/en") === true, "canonical /en");
  check((await page.locator('meta[property="og:locale"]').getAttribute("content")) === "en_GB", "og:locale en_GB");

  // ── German home links to English ──
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check((await page.evaluate(() => document.documentElement.lang)) === "de", "German home stays de");
  check((await page.locator('header a[hreflang="en"]').first().getAttribute("href")) === "/en", "language switch → /en");

  // ── English contact form: validation and success in English ──
  await q(`DELETE FROM "ContactMessage"`);
  await page.goto(`${BASE}/en#contact`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Send!" }).click();
  await page.locator("#contact-name-error").waitFor();
  check((await page.locator("#contact-name-error").innerText()).includes("Please enter your name"), "English validation message");
  await page.fill("#contact-name", "Jane Doe");
  await page.fill("#contact-email", "jane@example.com");
  await page.fill("#contact-message", "Hello, please send us information about halal certification.");
  await page.getByRole("button", { name: "Send!" }).click();
  await page.getByText("Thank you! Your message has been sent.").waitFor();
  check((await q(`SELECT name FROM "ContactMessage"`)).length === 1, "English contact message stored");
  check((await page.locator('a[href="/en/privacy"]').count()) >= 1, "privacy note links to the English privacy page");

  // ── Sub-pages ──
  for (const [path, heading] of [
    ["/en/imprint", "Legal notice"],
    ["/en/privacy", "Privacy policy"],
    ["/en/verify-certificate", "Verify a certificate"],
  ] as const) {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    check(r?.status() === 200, `${path} answers 200`);
    check((await page.getByRole("heading", { name: heading }).count()) >= 1, `${path} shows "${heading}"`);
    check((await page.evaluate(() => document.documentElement.lang)) === "en", `${path} document language en`);
  }
  await page.goto(`${BASE}/en/imprint`);
  check((await page.locator('header a[hreflang="de"]').first().getAttribute("href")) === "/impressum", "imprint ↔ Impressum switch");

  // ── Sitemap ──
  const sitemap = await (await page.request.get(`${BASE}/sitemap.xml`)).text();
  check(sitemap.includes("/en/verify-certificate") && sitemap.includes('hreflang="de"'), "sitemap lists English pages with alternates");

  await end();
});
