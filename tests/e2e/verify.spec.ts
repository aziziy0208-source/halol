import fs from "node:fs";
import path from "node:path";
import { type Page, type Request, test } from "@playwright/test";
import { check, database, decodeQr, SA, sha256, totp } from "./helpers";
import { e2eEnvironment } from "./environment";

let ipSeq = 10;
/** A fresh documentation-range client IP (the server trusts X-Forwarded-For from its proxy). */
const nextIp = () => `203.0.113.${ipSeq++}`;

const env = e2eEnvironment("verify", 3205);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("public verification: /v/{token}, check by number, rate limits, scan log", async ({ browser }) => {
  const { client: db, q, one, waitDb, end } = await database(env.databaseUrl);
  await db.query(`DELETE FROM "RateLimitBucket"`);
  const certs = Object.fromEntries(
    (await q(`SELECT id, "certificateNumber" n, "publicToken" t, status FROM "Certificate" WHERE "certificateNumber" IS NOT NULL`)).map((c) => [c.n, c]),
  );
  const active = certs["H-202026.0001-1"];
  const expired = certs["H-202024.0001-1"];
  const revoked = certs["H-202026.0002-1"];
    const visitor = async (locale: string, ip = nextIp(), viewport = { width: 390, height: 844 }) => {
    const ctx = await browser.newContext({ locale, viewport, extraHTTPHeaders: { "x-forwarded-for": ip } });
    return { ctx, page: await ctx.newPage(), ip };
  };
  const statusOf = async (page: Page) => (await page.locator("#verify-status").innerText()).trim();

  // ── 1. Valid certificate, German browser ──
  let { ctx, page, ip } = await visitor("de-DE");
  const res = await page.goto(`${BASE}/v/${active.t}`);
  await page.locator("#verify-status").waitFor();
  check((await statusOf(page)) === "GÜLTIG", "valid certificate → GÜLTIG (German browser)");
  check(res?.headers()["x-robots-tag"] === "noindex, nofollow", "X-Robots-Tag: noindex, nofollow");
  check((await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow", "meta robots noindex, nofollow");
  const body = await page.locator("main").innerText();
  check(
    body.includes("H-202026.0001-1") && body.includes("Musterfirma Halal Foods GmbH") && body.includes("Deutschland") && body.includes("Geflügel-Wiener") && body.includes("OIC/SMIIC 1:2019"),
    "number, holder, country, products and standard shown",
  );
  check(body.includes("Zertifizierungsstelle") && body.includes("Rupert-Mayer-Str.44"), "certification body WHU shown");
  check(/Geprüft am \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/.test(body) && !body.includes("Wichtig"), "check time shown, no warning box on a valid certificate");
  check((await page.locator("main").getAttribute("lang")) === null && (await page.locator("div[lang='de']").count()) === 1, "page content marked lang=de");
  check(!(await page.content()).includes(active.id), "internal certificate id is not exposed");
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(noOverflow, "no horizontal scrolling on a phone (390 px)");
  await page.locator('img[alt^="Vorschau"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => (document.querySelector<HTMLImageElement>('img[alt^="Vorschau"]')?.naturalWidth ?? 0) > 0, null, { timeout: 30000 });
  check(true, "preview image loads");
  const webp = await page.request.get(`${BASE}/v/${active.t}/preview.webp`);
  const webpBody = await webp.body();
  const pngSize = fs.statSync(path.join(env.storageDir, `certificates/H-202026.0001-1/rev-0/preview.png`)).size;
  check(webp.headers()["content-type"] === "image/webp" && webpBody.subarray(0, 4).toString() === "RIFF" && webpBody.length < pngSize / 2, `WebP preview ${Math.round(webpBody.length / 1024)} kB (PNG ${Math.round(pngSize / 1024)} kB)`);
  const pdf = await page.request.get(`${BASE}/v/${active.t}/certificate.pdf`);
  const pdfBody = await pdf.body();
  const stored = await one(`SELECT "pdfSha256" FROM "Certificate" WHERE id=$1`, [active.id]);
  check(pdf.status() === 200 && pdfBody.subarray(0, 5).toString() === "%PDF-" && sha256(pdfBody) === stored.pdfSha256, "PDF herunterladen = stored official PDF (checksum)");
  check((pdf.headers()["content-disposition"] || "").includes("H-202026.0001-1.pdf"), "PDF named after the certificate");
  const scans = await waitDb(`SELECT * FROM "ScanLog" WHERE "certificateId"=$1`, [active.id], (r) => r.length >= 1);
  check(scans.length === 1 && scans[0].channel === "QR" && /^[0-9a-f]{32}$/.test(scans[0].ipHash) && scans[0].userAgent, "scan logged: channel QR, hashed IP, user agent");
  check(!JSON.stringify(scans[0]).includes(ip), "scan log contains no IP address");
  await page.reload();
  await page.locator("#verify-status").waitFor();
  await page.waitForTimeout(800);
  check((await q(`SELECT id FROM "ScanLog" WHERE "certificateId"=$1`, [active.id])).length === 1, "reload within a minute is not counted twice");
  await ctx.close();

  // ── 2. Languages ──
  ({ ctx, page } = await visitor("en-US"));
  await page.goto(`${BASE}/v/${active.t}`);
  check((await statusOf(page)) === "VALID" && (await page.locator("main").innerText()).includes("Certificate holder"), "English browser → VALID (English page)");
  await Promise.all([page.waitForURL(/lang=de/), page.getByRole("link", { name: "Deutsch" }).click()]);
  check((await statusOf(page)) === "GÜLTIG", "language switch DE/EN");
  await ctx.close();
  ({ ctx, page } = await visitor("tr-TR"));
  await page.goto(`${BASE}/v/${active.t}`);
  check((await statusOf(page)) === "VALID", "other browser languages → English");
  await page.goto(`${BASE}/v/${active.t}?lang=de`);
  check((await statusOf(page)) === "GÜLTIG", "?lang=de overrides the browser");
  await ctx.close();

  // ── 3. Other states ──
  ({ ctx, page } = await visitor("de-DE"));
  await page.goto(`${BASE}/v/${expired.t}`);
  let text = await page.locator("main").innerText();
  check((await statusOf(page)) === "ABGELAUFEN" && text.includes("abgelaufen"), "expired certificate → ABGELAUFEN");
  check((await page.getByRole("link", { name: "PDF herunterladen" }).count()) === 0 && text.includes("nur für gültige Zertifikate"), "no PDF for expired certificates");
  check((await page.request.get(`${BASE}/v/${expired.t}/certificate.pdf`)).status() === 404, "PDF route refuses expired certificates");
  await page.goto(`${BASE}/v/${revoked.t}`);
  check((await statusOf(page)) === "WIDERRUFEN" && /widerrufen/.test(await page.locator("main").innerText()), "revoked certificate → WIDERRUFEN");
  for (const [label, token] of [["unknown token", "AAAAAAAAAAAAAAAA"], ["malformed token", "abc'--"]]) {
    await page.goto(`${BASE}/v/${encodeURIComponent(token)}`);
    text = await page.locator("main").innerText();
    check((await statusOf(page)) === "NICHT GEFUNDEN" && text.includes("gefälscht"), `${label} → NICHT GEFUNDEN with forgery warning`);
  }
  // Drafts and certificates awaiting approval are never public, even with their token.
  const company = await one(`SELECT id FROM "Company" LIMIT 1`);
  const admin = await one(`SELECT id FROM "User" WHERE role='SUPER_ADMIN' LIMIT 1`);
  for (const status of ["DRAFT", "PENDING_APPROVAL"]) {
    const token = `Draft${status.slice(0, 4)}Token${status.length}`.padEnd(16, "x").slice(0, 16);
    await db.query(
      `INSERT INTO "Certificate" (id, "publicToken", status, "companyId", scope, "createdById", "updatedAt") VALUES ($1,$2,$3,$4,'Entwurf',$5,now())`,
      [`test-${status}`, token, status, company.id, admin.id],
    );
    await page.goto(`${BASE}/v/${token}`);
    check((await statusOf(page)) === "NICHT GEFUNDEN", `${status} → not found (never public)`);
  }

  // Live status: admin changes are visible immediately (no caching).
  await db.query(`UPDATE "Certificate" SET status='SUSPENDED', "suspendedAt"=now() WHERE id=$1`, [active.id]);
  await page.goto(`${BASE}/v/${active.t}`);
  check((await statusOf(page)) === "AUSGESETZT" && (await page.getByRole("link", { name: "PDF herunterladen" }).count()) === 0, "suspension visible immediately → AUSGESETZT, no PDF");
  check((await page.request.get(`${BASE}/v/${active.t}/preview.webp`)).status() === 404, "preview refused while suspended");
  await db.query(`UPDATE "Certificate" SET status='ACTIVE', "suspendedAt"=null WHERE id=$1`, [active.id]);
  await db.query(`UPDATE "Certificate" SET "validUntil"=(now() AT TIME ZONE 'Europe/Berlin')::date - 1 WHERE id=$1`, [active.id]);
  await page.goto(`${BASE}/v/${active.t}`);
  check((await statusOf(page)) === "ABGELAUFEN", "validUntil in the past → ABGELAUFEN automatically");
  await db.query(`UPDATE "Certificate" SET "validUntil"='2027-03-01' WHERE id=$1`, [active.id]);
  await ctx.close();

  // ── 4. Superseded chain ──
  await db.query(
    `INSERT INTO "Certificate" (id, "certificateNumber", revision, "publicToken", status, "companyId", scope, category, "issueDate", "validUntil", "signatoryId", "templateVersion", snapshot, "createdById", "issuedAt", "issuedById", "updatedAt")
     SELECT 'test-rev1', "certificateNumber", 1, 'Rev1VerifyToken1', 'ACTIVE', "companyId", scope, category, "issueDate", "validUntil", "signatoryId", "templateVersion",
            jsonb_set(snapshot::jsonb, '{revision}', '1'), "createdById", now(), "issuedById", now()
     FROM "Certificate" WHERE id=$1`,
    [active.id],
  );
  await db.query(`UPDATE "Certificate" SET status='SUPERSEDED', "supersededById"='test-rev1' WHERE id=$1`, [active.id]);
  ({ ctx, page } = await visitor("de-DE"));
  await page.goto(`${BASE}/v/${active.t}`);
  check((await statusOf(page)) === "ERSETZT", "old revision → ERSETZT");
  await Promise.all([page.waitForURL(/Rev1VerifyToken1/), page.getByRole("link", { name: /Aktuelle Fassung anzeigen \(Rev\. 1\)/ }).click()]);
  check((await statusOf(page)) === "GÜLTIG" && (await page.locator("main").innerText()).includes("H-202026.0001-1 · Rev. 1"), "link leads to the current revision (GÜLTIG, Rev. 1)");
  await ctx.close();

  // ── 5. Bots, rate limit ──
  const botRes = await fetch(`${BASE}/v/${expired.t}`, { headers: { "user-agent": "WhatsApp/2.23.20 A", "x-forwarded-for": nextIp() } });
  await botRes.text();
  await new Promise((r) => setTimeout(r, 800));
  check((await q(`SELECT id FROM "ScanLog" WHERE "certificateId"=$1`, [expired.id])).length === 1, "link-preview bots are not counted");
  const limitedIp = nextIp();
  let lastText = "";
  for (let i = 0; i < 31; i++) {
    const r = await fetch(`${BASE}/v/AAAAAAAAAAAAAAAB`, { headers: { "x-forwarded-for": limitedIp, "accept-language": "de" } });
    lastText = await r.text();
    if (i === 29) check(!lastText.includes("Zu viele Anfragen"), "30 requests per minute allowed");
  }
  check(lastText.includes("Zu viele Anfragen"), "31st request in a minute → rate limited");
  const otherIp = await (await fetch(`${BASE}/v/AAAAAAAAAAAAAAAB`, { headers: { "x-forwarded-for": nextIp() } })).text();
  check(!otherIp.includes("Zu viele Anfragen") && !otherIp.includes("Too many requests"), "other visitors unaffected");

  // ── 6. Manual check by number (ALTCHA) ──
  ({ ctx, page, ip } = await visitor("de-DE", nextIp(), { width: 1280, height: 900 }));
  await page.goto(`${BASE}/zertifikat-pruefen`, { waitUntil: "networkidle" });
  check((await page.getByRole("heading", { name: "Zertifikat prüfen" }).count()) === 1, "manual check page (German)");
  const submit = page.getByRole("button", { name: "Prüfen" });
  check(await submit.isDisabled(), "submit disabled until the security check is solved");
  await page.fill("#certificate-number", "whu 2099 99999");
  await page.locator("altcha-widget").waitFor();
  await page.waitForFunction(() => document.querySelector("altcha-widget")?.getState?.() === "verified", null, { timeout: 30000 });
  check(await submit.isEnabled(), "ALTCHA proof-of-work solved automatically");
  check(!(await ctx.cookies()).length, "no cookies set by the check");
  let actionRequest: Request | undefined;
  page.once("request", (r) => {
    if (r.method() === "POST") actionRequest = r;
  });
  await submit.click();
  await page.locator("#manual-check-error").filter({ hasText: "WHU-2099-99999" }).waitFor();
  check((await page.locator("#manual-check-error").innerText()).includes("kein Zertifikat gefunden") && (await page.inputValue("#certificate-number")) === "whu 2099 99999", "unknown number → not found message (input kept, normalised)");
  const replay = await page.request.fetch(actionRequest!);
  check((await replay.text()).includes("Sicherheitsprüfung ist fehlgeschlagen"), "replayed ALTCHA payload rejected");
  await page.fill("#certificate-number", "h-202026.0002-1");
  await page.waitForFunction(() => document.querySelector("altcha-widget")?.getState?.() === "verified", null, { timeout: 30000 });
  await Promise.all([page.waitForURL(/\/v\/[0-9A-Za-z]{16}\?lang=de&via=manual/), submit.click()]);
  check((await statusOf(page)) === "WIDERRUFEN", "number lookup (lower case) → same result page");
  check((await waitDb(`SELECT channel FROM "ScanLog" WHERE "certificateId"=$1 ORDER BY "scannedAt" DESC`, [revoked.id], (r) => r.length >= 2))[0]?.channel === "MANUAL", "manual check logged as MANUAL");
  await page.goto(`${BASE}/zertifikat-pruefen`, { waitUntil: "networkidle" });
  await page.fill("#certificate-number", "H-202026.0001-1");
  await page.waitForFunction(() => document.querySelector("altcha-widget")?.getState?.() === "verified", null, { timeout: 30000 });
  await Promise.all([page.waitForURL(/\/v\/Rev1VerifyToken1/), submit.click()]);
  check((await statusOf(page)) === "GÜLTIG", "number lookup returns the current revision");
  for (let i = 0; i < 9; i++) await page.request.fetch(actionRequest!);
  check((await (await page.request.fetch(actionRequest!)).text()).includes("Zu viele Prüfungen"), "manual check rate limited (10 per 10 minutes)");
  await ctx.close();
  ({ ctx, page } = await visitor("de-DE"));
  await page.goto(`${BASE}/zertifikat-pruefen?lang=en`, { waitUntil: "networkidle" });
  check((await page.getByRole("heading", { name: "Verify a certificate" }).count()) === 1, "manual check page in English (?lang=en)");
  const challenge = await (await page.request.get(`${BASE}/api/altcha`)).json();
  check(challenge.parameters?.algorithm === "SHA-256" && challenge.signature && challenge.parameters.expiresAt, "challenge is signed and expires");
  await ctx.close();
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check(sitemap.includes("/zertifikat-pruefen") && !sitemap.includes("/v/"), "sitemap lists the manual check, never /v/ pages");

  // ── 7. QR code → page, admin statistics ──
  await db.query(`DELETE FROM "RateLimitBucket"`);
  const saCtx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const sa = await saCtx.newPage();
  await sa.goto(`${BASE}/admin/login`);
  await sa.fill("#email", "admin@example.com");
  await sa.fill("#password", SA.password);
  await Promise.all([sa.waitForURL(/2fa\/setup/), sa.click('button[type="submit"]')]);
  const secret = (await sa.locator("p.select-all").innerText()).replace(/\s/g, "");
  await sa.fill("#code", totp(secret));
  await Promise.all([sa.waitForURL(`${BASE}/admin`), sa.click('button[type="submit"]')]);
  check((await sa.getByRole("main").innerText()).includes("Verification checks (30 days)"), "dashboard: verification checks (30 days)");
  const qr = decodeQr(await (await sa.request.get(`${BASE}/admin/certificates/${revoked.id}/files/certificate.png`)).body());
  check(qr === `${BASE}/v/${revoked.t}`, "QR code on the certificate encodes its /v/ link");
  ({ ctx, page } = await visitor("de-DE"));
  await page.goto(qr ?? `${BASE}/v/missing-qr`);
  check((await statusOf(page)) === "WIDERRUFEN", "scanning the QR code opens exactly this certificate's page");
  await ctx.close();
  await sa.goto(`${BASE}/admin/certificates/${revoked.id}`);
  const detail = await sa.getByRole("main").innerText();
  check(/Verification checks \(\d+\)/.test(detail) && detail.includes("Manual check") && detail.includes("QR code"), "certificate page lists QR and manual checks");

  await db.query(`DELETE FROM "Certificate" WHERE id LIKE 'test-%' AND id <> 'test-rev1'`);
    await end();
});
