import { test } from "@playwright/test";
import { check, database } from "./helpers";
import { e2eEnvironment } from "./environment";

const env = e2eEnvironment("site", 3201);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("public site: layout, mobile menu, contact form, SEO", async ({ browser }) => {
  const { client: db, end } = await database(env.databaseUrl);
  await db.query(`DELETE FROM "ContactMessage"`);
  await db.query(`DELETE FROM "RateLimitBucket"`);
  const count = async () => (await db.query(`SELECT count(*)::int AS c FROM "ContactMessage"`)).rows[0].c;

  
  // ── Layout: no horizontal scrolling on phones, menu works ──
  for (const width of [360, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(BASE, { waitUntil: "networkidle" });
    // In mobile emulation Chrome widens the layout viewport to fit overflowing content,
    // so compare against the requested screen width, not innerWidth.
    const overflow = await page.evaluate(
      (w) => Math.max(document.documentElement.scrollWidth, window.innerWidth) - w,
      width,
    );
    check(overflow <= 0, `no horizontal overflow at ${width}px (excess ${overflow}px)`);
    await page.close();
  }
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 800 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce", // instant anchor scrolling, so the position can be measured
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    const visible = await page.locator("#mobile-nav").isVisible();
    check(visible, "mobile menu opens");
    await page.locator("#mobile-nav").getByRole("link", { name: "Kontakt" }).click();
    await page.waitForTimeout(800);
    const top = await page.evaluate(() => document.getElementById("contact")!.getBoundingClientRect().top);
    check(top >= 60 && top <= 100, `"Kontakt" link scrolls the section just below the sticky header (top=${Math.round(top)}px)`);
    check(!(await page.locator("#mobile-nav").isVisible()), "mobile menu closes after choosing an item");
    await page.close();
  }

  // ── Contact form ──
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let visit = 0;
  const open = async () => {
    // A fresh document each time (same-URL hash navigation would keep the old form state),
    // and wait until React has hydrated the form so the server action runs via JS.
    await page.goto(`${BASE}/?visit=${++visit}#contact`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const form = document.querySelector<HTMLInputElement>("#contact-name")?.form;
      return form && Object.keys(form).some((k) => k.startsWith("__react"));
    });
  };
  const fill = async (name: string, email: string, message: string) => {
    await page.fill("#contact-name", name);
    await page.fill("#contact-email", email);
    await page.fill("#contact-message", message);
  };
  const submit = async () => {
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST", { timeout: 15000 }),
      page.getByRole("button", { name: "Senden!" }).click(),
    ]);
    await page.waitForSelector('[role="status"], [role="alert"]', { timeout: 10000 });
    await page.waitForTimeout(200);
  };

  await open();
  await submit();
  check((await page.locator("#contact-name-error").count()) === 1, "empty form → field error for name");
  check((await page.locator("#contact-message-error").count()) === 1, "empty form → field error for message");
  check((await count()) === 0, "invalid submission is not stored");

  await fill("Erika Müller-Größe", "not-an-email", "Hallo, bitte senden Sie Informationen.");
  await submit();
  check((await page.locator("#contact-email-error").count()) === 1, "bad e-mail → e-mail error");
  check((await page.inputValue("#contact-name")) === "Erika Müller-Größe", "entered values survive a failed submit (umlauts intact)");

  await open();
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>("#contact-website")!.value = "http://spam.example";
  });
  await fill("Bot", "bot@example.com", "Buy cheap things now!!!");
  await submit();
  check((await page.locator('[role="status"]').count()) === 1, "honeypot filled → fake success shown");
  check((await count()) === 0, "honeypot submission is NOT stored");

  for (let i = 1; i <= 6; i++) {
    await open();
    await fill(`Testkunde ${i}`, `kunde${i}@example.com`, `Testnachricht Nummer ${i} – äöüß ✓`);
    await submit();
    const ok = (await page.locator('[role="status"]').count()) === 1;
    if (i <= 5) check(ok, `valid message #${i} accepted`);
    else check(!ok && /zu viele/i.test(await page.locator('form [role="alert"]').innerText()), "6th message within the hour is rate-limited");
  }
  check((await count()) === 5, `exactly 5 messages stored (got ${await count()})`);
  const row = (await db.query(`SELECT name, email, message, "ipHash" FROM "ContactMessage" ORDER BY "createdAt" LIMIT 1`)).rows[0];
  check(row.message.includes("äöüß ✓"), "umlauts/symbols stored correctly");
  check(/^[0-9a-f]{32}$/.test(row.ipHash) && !row.ipHash.includes("127.0.0.1"), "only a 32-char IP hash is stored, no raw IP");

  // ── SEO basics ──
  const seo = await browser.newPage();
  await seo.goto(BASE, { waitUntil: "load" });
  check((await seo.title()).startsWith("Halal Zertifikat"), `home <title>: ${await seo.title()}`);
  check((await seo.locator('meta[property="og:title"]').count()) === 1, "Open Graph tags present");
  check((await seo.locator("h1").count()) === 1, "exactly one <h1> on the home page");
  await seo.goto(`${BASE}/datenschutz`);
  check((await seo.locator('meta[name="robots"][content*="noindex"]').count()) === 1, "Datenschutz placeholder is noindex");
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  check(robots.includes("Disallow: /admin") && robots.includes("Sitemap:"), "robots.txt disallows /admin and links the sitemap");
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check(sitemap.includes("/impressum") && !sitemap.includes("/datenschutz"), "sitemap lists indexable pages only");

    await end();
});
