import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { PNG } from "pngjs";
import { check, database, decodeQr, SA, sha256, totp } from "./helpers";
import { e2eEnvironment } from "./environment";

const env = e2eEnvironment("certificates", 3203);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("certificate preview, PDF/PNG/QR downloads, private storage", async ({ browser }) => {
  const { client: db, q, end } = await database(env.databaseUrl);
  await db.query(`DELETE FROM "RateLimitBucket"`);
  
  // Anonymous download attempt
  const cert = (await q(`SELECT id, "publicToken", "certificateNumber" FROM "Certificate" WHERE "certificateNumber"='H-202026.0001-1'`))[0];
  const anon = await fetch(`${BASE}/admin/certificates/${cert.id}/files/certificate.pdf`, { redirect: "manual" });
  check(anon.status === 307 && (anon.headers.get("location") || "").includes("/admin/login"), "anonymous PDF download → sign-in");

  // Sign in as super admin (sets up 2FA on the fresh DB)
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", SA.password);
  await Promise.all([page.waitForURL(/2fa\/setup/), page.click('button[type="submit"]')]);
  const secret = (await page.locator("p.select-all").innerText()).replace(/\s/g, "");
  await page.fill("#code", totp(secret));
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click('button[type="submit"]')]);

  // List
  await page.goto(`${BASE}/admin/certificates`);
  await page.getByRole("heading", { name: "Certificates" }).waitFor();
  const list = await page.getByRole("main").innerText();
  check(list.includes("H-202026.0001-1") && /Valid/.test(list) && /Expired/.test(list) && /Revoked/.test(list), "list shows the 3 seeded certificates with Valid / Expired / Revoked");

  // Detail + preview iframe
  await page.goto(`${BASE}/admin/certificates/${cert.id}`);
  const frame = page.frameLocator("iframe");
  await frame.locator("html[data-ready='1']").waitFor({ timeout: 15000 });
  const iframeHandle = await page.locator("iframe").elementHandle();
  const f = (await iframeHandle!.contentFrame())!;
  const fontsOk = await f.evaluate(`document.fonts.check('700 18pt "Cert Carlito"') && document.fonts.check('400 11pt "Cert Carlito"') && [...document.fonts].some(ff => ff.family.includes('Cert') && ff.status === 'loaded')`);
  check(fontsOk, "preview iframe renders with the embedded certificate fonts");
  const isolated = await f.evaluate(`(() => { try { return window.parent.document.title ? "leak" : "leak"; } catch (e) { return "blocked"; } })()`);
  check(isolated === "blocked", "preview iframe is sandboxed (cannot read the admin page)");
  const previewText = String(await f.evaluate("document.body.innerText"));
  check(previewText.includes("H-202026.0001-1") && previewText.includes("Musterfirma Halal Foods GmbH") && previewText.includes("Geflügel-Wiener"), "preview shows number, company and products from the DB");

  // PDF download: rendered once, stored, checksummed
  const filesUrl = `${BASE}/admin/certificates/${cert.id}/files`;
  const r1 = await page.request.get(`${filesUrl}/certificate.pdf`);
  const pdf1 = await r1.body();
  check(r1.status() === 200 && r1.headers()["content-type"] === "application/pdf" && pdf1.subarray(0, 5).toString() === "%PDF-", "PDF download works");
  check((r1.headers()["content-disposition"] || "").includes("H-202026.0001-1.pdf") && r1.headers()["cache-control"].includes("no-store"), "PDF is an attachment named after the certificate, not cached");
  const row = (await q(`SELECT "pdfKey", "previewKey", "pdfSha256" FROM "Certificate" WHERE id=$1`, [cert.id]))[0];
  check(row.pdfKey && row.previewKey && row.pdfSha256 === sha256(pdf1), "pdfKey, previewKey and SHA-256 recorded; checksum matches the download");
  const stored = path.join(env.storageDir, row.pdfKey);
  check(fs.existsSync(stored) && sha256(fs.readFileSync(stored)) === row.pdfSha256, `file stored privately (${row.pdfKey})`);
  check(!(await fetch(`${BASE}/${row.pdfKey}`)).ok, "stored PDF is not reachable under a public URL");
  const r2 = await page.request.get(`${filesUrl}/certificate.pdf`);
  check(sha256(await r2.body()) === row.pdfSha256, "second download returns the identical stored PDF (no re-render)");
  check((await q(`SELECT count(*)::int c FROM "AuditLog" WHERE action='certificate.files.generate' AND "entityId"=$1`, [cert.id]))[0].c === 1, "file generation audited exactly once");

  // PNG + QR
  const png = await (await page.request.get(`${filesUrl}/certificate.png`)).body();
  const expectedUrl = `${BASE}/v/${cert.publicToken}`;
  check(png.subarray(1, 4).toString() === "PNG" && decodeQr(png) === expectedUrl, `PNG preview: the printed QR decodes to ${expectedUrl}`);
  const qrSvg = await (await page.request.get(`${filesUrl}/qr.svg`)).text();
  check(qrSvg.startsWith("<?xml") && qrSvg.includes("<svg"), "QR code download as SVG (vector, for packaging)");
  const qrPng = await (await page.request.get(`${filesUrl}/qr.png`)).body();
  const qrImg = PNG.sync.read(qrPng);
  check(qrImg.width >= 1000 && decodeQr(qrPng) === expectedUrl, `QR code download as PNG (${qrImg.width}px) decodes correctly`);

  // Tampered stored PDF is refused
  const original = fs.readFileSync(stored);
  fs.writeFileSync(stored, Buffer.concat([original, Buffer.from("%tampered")]));
  const tampered = await page.request.get(`${filesUrl}/certificate.pdf`);
  check(tampered.status() === 500, `tampered stored PDF is not served (status ${tampered.status()})`);
  fs.writeFileSync(stored, original);

  // Draft: watermark, no QR, nothing stored
  const draftId = "draftcheck1";
  await db.query(`INSERT INTO "Certificate" (id, status, "companyId", scope, category, "issueDate", "validUntil", "createdById", "updatedAt")
    SELECT $1, 'DRAFT', "companyId", 'Entwurf: Herstellung von Backwaren', category, '2026-12-01', '2027-11-30', "createdById", now() FROM "Certificate" WHERE id=$2`, [draftId, cert.id]);
  await page.goto(`${BASE}/admin/certificates/${draftId}`);
  // frameLocator re-resolves the iframe (it can be re-attached while the page streams in).
  const df = page.frameLocator("iframe");
  await df.locator("html[data-ready='1']").waitFor({ state: "attached", timeout: 15000 });
  const draftText = await df.locator("body").innerText();
  check(draftText.includes("ENTWURF · DRAFT") && draftText.includes("QR code is created on issue"), "draft preview: watermark and QR placeholder");
  const dPdf = await page.request.get(`${BASE}/admin/certificates/${draftId}/files/certificate.pdf`);
  check(dPdf.status() === 200 && (dPdf.headers()["content-disposition"] || "").includes("ENTWURF"), "draft PDF downloadable (rendered on the fly, named ENTWURF-…)");
  check((await q(`SELECT "pdfKey" FROM "Certificate" WHERE id=$1`, [draftId]))[0].pdfKey === null, "nothing stored for drafts");
  check((await page.request.get(`${BASE}/admin/certificates/${draftId}/files/qr.svg`)).status() === 404, "drafts have no QR code");

  // Template preview + sample PDF
  await page.goto(`${BASE}/admin/certificates/template?variant=long`);
  const tf = page.frameLocator("iframe");
  await tf.locator("html[data-ready='1']").waitFor({ state: "attached", timeout: 15000 });
  const pagesInPreview = await tf.locator(".page").count();
  check(pagesInPreview >= 2 && (await tf.locator("body").innerText()).includes("MUSTER · SAMPLE"), `template preview (long sample): ${pagesInPreview} pages (annex), watermarked as sample`);
  const sample = await page.request.get(`${BASE}/admin/certificates/template/files/sample.pdf?variant=long`);
  check(sample.status() === 200 && (await sample.body()).subarray(0, 5).toString() === "%PDF-", "sample PDF download works");

    await end();
});
