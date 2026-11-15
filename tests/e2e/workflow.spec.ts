import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Page, test } from "@playwright/test";
import { PNG } from "pngjs";
import writeXlsxFile from "write-excel-file/node";
import { addMonths, berlinToday, check, database, decodeQr, SA, sha256, totp } from "./helpers";
import { e2eEnvironment } from "./environment";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "whu-wf-"));
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Detail URLs (ids are cuids — "new" must not match).
const COMPANY_URL = /\/admin\/companies\/c[a-z0-9]{20,}$/;
const CERT_URL = /\/admin\/certificates\/c[a-z0-9]{20,}$/;
const ALERT = 'main [role="alert"], main [role="status"]';

function fixture(name: string, content: string | Buffer): string {
  const file = path.join(TMP, name);
  fs.writeFileSync(file, content);
  return file;
}

function signaturePng(): Buffer {
  const png = new PNG({ width: 240, height: 90 });
  for (let y = 0; y < 90; y++)
    for (let x = 0; x < 240; x++) {
      const i = (y * 240 + x) * 4;
      const ink = Math.abs(y - 45 - Math.round(20 * Math.sin(x / 18))) < 3;
      png.data[i] = 20;
      png.data[i + 1] = 30;
      png.data[i + 2] = 90;
      png.data[i + 3] = ink ? 255 : 0;
    }
  // Trailing bytes after IEND: must not survive the re-encoding.
  return Buffer.concat([PNG.sync.write(png), Buffer.from("EXTRA-PAYLOAD")]);
}

const env = e2eEnvironment("workflow", 3204);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());
test.afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

test("certificate workflow: settings, companies, editor, approval, revisions, export, legacy import", async ({ browser }) => {
  const { client: db, q, one, waitDb, end } = await database(env.databaseUrl);
  await db.query(`DELETE FROM "RateLimitBucket"`);
    const newCtx = () => browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const msg = async (page: Page, text: string, timeout = 30000) =>
    page.locator(ALERT).filter({ hasText: text }).first().waitFor({ timeout }).then(() => true, () => false);

  // ── Sign in as super admin (fresh DB: 2FA setup) ──
  const saCtx = await newCtx();
  const sa = await saCtx.newPage();
  sa.on("dialog", (d) => d.accept());
  await sa.goto(`${BASE}/admin/login`);
  await sa.fill("#email", "admin@example.com");
  await sa.fill("#password", SA.password);
  await Promise.all([sa.waitForURL(/2fa\/setup/), sa.click('button[type="submit"]')]);
  const secret = (await sa.locator("p.select-all").innerText()).replace(/\s/g, "");
  await sa.fill("#code", totp(secret));
  await Promise.all([sa.waitForURL(`${BASE}/admin`), sa.click('button[type="submit"]')]);
  const saId = (await one(`SELECT id FROM "User" WHERE email='admin@example.com'`)).id;

  // ── 1. Settings ──
  await sa.goto(`${BASE}/admin/settings`);
  await sa.fill("#defaultValidityMonths", "24");
  await sa.getByRole("button", { name: "Save settings" }).click();
  check(await msg(sa, "Settings saved"), "general settings saved");
  const validity = await one(`SELECT value FROM "Setting" WHERE key='certificate.defaultValidityMonths'`);
  check(validity && Number(validity.value) === 24, "default validity stored (24 months)");
  check((await sa.locator("#numberFormat-hint").innerText()).includes("H-202026."), "settings show the next certificate number (WHU format)");
  await sa.fill("#numberFormat", "ABC-{NN}");
  await sa.getByRole("button", { name: "Save settings" }).click();
  check(await msg(sa, "Invalid values"), "invalid number format rejected");
  check((await one(`SELECT value FROM "Setting" WHERE key='certificate.numberFormat'`))?.value === "H-2020{YY}.{NNNN}-1", "stored number format unchanged");

  await sa.goto(`${BASE}/admin/settings`);
  await sa.fill("#new-standard-code", "HAS 23000:2");
  await sa.fill("#new-standard-title", "Halal Assurance System Requirements");
  await sa.getByRole("button", { name: "Add standard" }).click();
  const has = (await waitDb(`SELECT id, "isActive" FROM "Standard" WHERE code='HAS 23000:2'`, [], (r) => r.length === 1))[0];
  check(Boolean(has?.isActive), "standard added");
  await sa.fill("#new-standard-code", "has 23000:2");
  await sa.fill("#new-standard-title", "Duplicate");
  await sa.getByRole("button", { name: "Add standard" }).click();
  check(await msg(sa, "already exists"), "duplicate standard code rejected (case-insensitive)");
  await sa.locator("li", { has: sa.locator('input[value="HAS 23000:2"]') }).getByRole("button", { name: "Deactivate" }).click();
  check((await waitDb(`SELECT "isActive" FROM "Standard" WHERE id=$1`, [has.id], (r) => r[0]?.isActive === false))[0].isActive === false, "standard deactivated");

  const sigFile = fixture("signature.png", signaturePng());
  const stampFile = fixture(
    "stamp.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><script>alert(1)</script><circle cx="70" cy="70" r="60" fill="none" stroke="#1b2a6b" stroke-width="8"/><text x="70" y="78" font-size="20" text-anchor="middle" fill="#1b2a6b">WHU</text></svg>',
  );
  const fakeFile = fixture("fake.png", "this is not an image");
  await sa.fill("#new-signatory-name", "Dr. Aisha Rahman");
  await sa.fill("#new-signatory-title", "Head of Certification");
  await sa.setInputFiles("#new-signatory-signature", sigFile);
  await sa.setInputFiles("#new-signatory-stamp", stampFile);
  await sa.getByRole("button", { name: "Add signatory" }).click();
  const signatory = (
    await waitDb(`SELECT * FROM "Signatory" WHERE name='Dr. Aisha Rahman'`, [], (r) => r[0]?.signatureImageKey && r[0]?.stampImageKey)
  )[0];
  check(
    signatory && /^signatories\/[^/]+\/signature-[0-9a-f]{20}\.png$/.test(signatory.signatureImageKey) && /stamp-[0-9a-f]{20}\.png$/.test(signatory.stampImageKey),
    "signatory created with private, content-addressed image keys",
  );
  const sigStored = fs.readFileSync(path.join(env.storageDir, signatory.signatureImageKey));
  const stampStored = fs.readFileSync(path.join(env.storageDir, signatory.stampImageKey));
  check(sigStored.subarray(0, 8).equals(PNG_MAGIC) && !sigStored.includes("EXTRA-PAYLOAD"), "PNG upload re-encoded (trailing payload dropped)");
  check(stampStored.subarray(0, 8).equals(PNG_MAGIC) && !stampStored.includes("script"), "SVG upload rasterised to PNG (script gone)");
  const stampPng = PNG.sync.read(stampStored);
  check(stampPng.width >= 1000, `SVG rasterised at print resolution (${stampPng.width}px)`);
  check(!(await fetch(`${BASE}/${signatory.signatureImageKey}`)).ok, "signature image not reachable under a public URL");
  await sa.goto(`${BASE}/admin/settings`);
  check((await sa.locator('img[src^="data:image/png;base64,"]').count()) >= 2, "settings page shows the uploaded images (inline data URIs)");
  await sa.setInputFiles(`#signature-${signatory.id}`, fakeFile);
  await sa.locator("li", { has: sa.locator(`#signature-${signatory.id}`) }).getByRole("button", { name: "Save" }).click();
  check(await msg(sa, "could not be read"), "non-image upload rejected");
  check((await one(`SELECT "signatureImageKey" k FROM "Signatory" WHERE id=$1`, [signatory.id])).k === signatory.signatureImageKey, "rejected upload leaves the stored image unchanged");

  // ── 2. Companies ──
  await sa.goto(`${BASE}/admin/companies/new`);
  await sa.fill("#company-name", "Testfirma Halal Bakery GmbH");
  await sa.fill("#company-address", "Backstraße 5");
  await sa.fill("#company-postalCode", "10115");
  await sa.fill("#company-city", "Berlin");
  await sa.fill("#company-email", "info@bakery.example");
  await Promise.all([sa.waitForURL(COMPANY_URL), sa.getByRole("button", { name: "Save company" }).click()]);
  const company = await one(`SELECT * FROM "Company" WHERE name='Testfirma Halal Bakery GmbH'`);
  check(company && company.country === "DE" && company.email === "info@bakery.example", "company created → detail page");
  await sa.fill("#company-city", "Berlin-Mitte");
  await sa.getByRole("button", { name: "Save company" }).click();
  check(await msg(sa, "Company saved"), "company edited");
  check((await one(`SELECT count(*)::int c FROM "AuditLog" WHERE action='company.update' AND "entityId"=$1`, [company.id])).c === 1, "company change audited");
  await sa.setInputFiles("#company-logo", sigFile);
  await sa.getByRole("button", { name: "Save company" }).click();
  const logoKey = (await waitDb(`SELECT "logoImageKey" k FROM "Company" WHERE id=$1`, [company.id], (r) => Boolean(r[0]?.k)))[0]?.k as string | undefined;
  check(logoKey && /^companies\/[^/]+\/logo-[0-9a-f]{20}\.png$/.test(logoKey), "company logo uploaded (private, re-encoded PNG)");
  await sa.reload();
  check(
    await sa.locator('img[alt="Company logo"][src^="data:image/png"]').waitFor().then(() => true, () => false),
    "company page shows the logo",
  );
  check((await sa.getByRole("button", { name: "Delete company" }).count()) === 1, "company without certificates can be deleted (button shown)");
  await sa.goto(`${BASE}/admin/companies?q=bakery`);
  check((await sa.getByRole("main").innerText()).includes("Testfirma Halal Bakery GmbH"), "company search finds it");
  await sa.goto(`${BASE}/admin/companies?q=zzzzzz`);
  check((await sa.getByRole("main").innerText()).includes("No companies found"), "company search without match");

  // ── 3. Editor (super admin, four-eyes on) ──
  await sa.goto(`${BASE}/admin/certificates/new?company=${company.id}`);
  check((await sa.inputValue("#company-select")) === company.id, "editor pre-selects the company from ?company=");
  const next = () => sa.getByRole("button", { name: "Next →" }).click();
  await next();
  await sa.fill("#scope", "Herstellung von Backwaren");
  await sa.fill("#category", "Lebensmittel");
  check(!(await sa.getByRole("main").innerText()).includes("HAS 23000:2"), "deactivated standard is not offered");
  await sa.getByLabel(/OIC\/SMIIC 1:2019/).check();
  const previewFrame = sa.frameLocator("iframe");
  const previewText = async () => {
    await sa.waitForTimeout(900);
    await previewFrame.locator("html[data-ready='1']").waitFor({ timeout: 15000 });
    return previewFrame.locator("body").innerText();
  };
  let live = await previewText();
  check(live.includes("Herstellung von Backwaren") && live.includes("Testfirma Halal Bakery GmbH") && live.includes("ENTWURF"), "live preview shows typed scope + company with DRAFT mark");
  check((await previewFrame.locator(".logo-gap img").count()) === 1, "live preview shows the company logo (official template v2)");
  await next();
  await sa.getByRole("button", { name: "+ Add product" }).click();
  await sa.getByLabel("Product 1", { exact: true }).fill("Fladenbrot");
  await sa.setInputFiles('input[type="file"]', fixture("products.csv", "Produkt;Marke;Artikelnummer\nSesamring;Bakery;A-1\n;ohne Name;\nSimit;Bakery;A-2\n"));
  check(await msg(sa, "2 products added, 1 row without a product name skipped"), "CSV product import (row without name skipped)");
  const xlsx = await writeXlsxFile([[{ value: "Name" }, { value: "Beschreibung" }], [{ value: "Börek" }, { value: "mit Spinat" }], [{ value: "Pide" }, null]]).toBuffer();
  await sa.setInputFiles('input[type="file"]', fixture("products.xlsx", xlsx));
  check(await msg(sa, "2 products added."), "Excel product import");
  check((await sa.getByRole("main").innerText()).includes("5 products"), "editor lists 5 products");
  live = await previewText();
  check(live.includes("Sesamring") && live.includes("Börek"), "live preview shows imported products");
  await next();
  const today = berlinToday();
  check((await sa.inputValue("#issueDate")) === today && (await sa.inputValue("#validUntil")) === addMonths(today, 24), "dates default to today + 24 months (settings)");
  await next();
  await sa.getByLabel(/Dr\. Aisha Rahman/).check();
  await next();
  const review = await sa.getByRole("main").innerText();
  check(review.includes("Everything needed for issuing is filled in"), "review step: complete");
  check((await sa.getByRole("button", { name: "Save and issue" }).count()) === 0 && review.includes("another admin issues"), "four-eyes: creator gets no issue button");
  await Promise.all([sa.waitForURL(CERT_URL), sa.getByRole("button", { name: "Save and submit for approval" }).click()]);
  const saDraftId = sa.url().split("/").pop();
  const saDraft = await one(`SELECT * FROM "Certificate" WHERE id=$1`, [saDraftId]);
  check(saDraft.status === "PENDING_APPROVAL" && saDraft.createdById === saId && saDraft.publicToken && !saDraft.certificateNumber, "draft saved + submitted (no number yet, token reserved)");
  check((await one(`SELECT count(*)::int c FROM "CertificateProduct" WHERE "certificateId"=$1`, [saDraftId])).c === 5, "5 products stored in order");
  check((await sa.getByRole("main").innerText()).includes("Awaiting approval") && (await sa.getByRole("main").innerText()).includes("Four-eyes principle"), "detail: awaiting approval, four-eyes notice");
  check((await sa.getByRole("button", { name: "Issue certificate" }).count()) === 0, "detail: creator cannot issue");
  await sa.getByRole("link", { name: "Open approval window" }).click();
  await sa.waitForURL(`${BASE}/admin/approvals/${saDraftId}`);
  const ownWindow = await sa.getByRole("main").innerText();
  check(
    ownWindow.includes("you created this certificate") && ownWindow.includes("switch the four-eyes principle off") && (await sa.getByRole("button", { name: "Approve and issue" }).count()) === 0,
    "approval window: creator sees the four-eyes notice (with the Settings hint), no approve button",
  );
  check((await sa.locator('a[href="/admin/approvals"]').first().innerText()).includes("1"), "navigation: Approvals shows 1 waiting");
  // Return to the issuer from the approval window (reason required).
  await sa.fill("#return-reason", "Bitte Produktliste prüfen");
  await Promise.all([sa.waitForURL(`${BASE}/admin/approvals`), sa.getByRole("button", { name: "Return with this reason" }).click()]);
  check((await waitDb(`SELECT status FROM "Certificate" WHERE id=$1`, [saDraftId], (r) => r[0].status === "DRAFT"))[0].status === "DRAFT", "returned to draft (from the approval window)");
  check((await one(`SELECT after FROM "AuditLog" WHERE action='certificate.return' AND "entityId"=$1`, [saDraftId]))?.after?.reason === "Bitte Produktliste prüfen", "return reason audited");

  // ── 4. Issuer creates a draft with a new company ──
  await sa.goto(`${BASE}/admin/users`);
  await sa.fill("#new-name", "Ida Issuer");
  await sa.fill("#new-email", "ida@example.com");
  await sa.selectOption("#new-role", "ISSUER");
  await sa.getByRole("button", { name: /create/i }).click();
  await sa.waitForSelector("p.select-all");
  const idaTemp = (await sa.locator("p.select-all").first().innerText()).trim();
  const isCtx = await newCtx();
  const is = await isCtx.newPage();
  is.on("dialog", (d) => d.accept());
  await is.goto(`${BASE}/admin/login`);
  await is.fill("#email", "ida@example.com");
  await is.fill("#password", idaTemp);
  await Promise.all([is.waitForURL(/\/admin\/account/), is.click('button[type="submit"]')]);
  await is.fill("#pw-current", idaTemp);
  await is.fill("#pw-next", "Issuer-Passwort-2026!");
  await is.fill("#pw-confirm", "Issuer-Passwort-2026!");
  await Promise.all([is.waitForURL(`${BASE}/admin`), is.getByRole("button", { name: "Change password" }).click()]);
  await is.goto(`${BASE}/admin/settings`);
  check((await is.getByRole("main").innerText()).includes("No access"), "issuer: settings forbidden");
  await is.goto(`${BASE}/admin/import`);
  check((await is.getByRole("main").innerText()).includes("No access"), "issuer: legacy import forbidden");

  await is.goto(`${BASE}/admin/certificates/new`);
  await is.getByLabel("New company").check();
  await is.fill("#new-company-name", "Neue Halal Metzgerei e.K.");
  await is.fill("#new-company-address", "Fleischweg 9");
  await is.fill("#new-company-postalCode", "50667");
  await is.fill("#new-company-city", "Köln");
  await is.getByRole("button", { name: "Next →" }).click();
  await is.fill("#scope", "Schlachtung und Zerlegung von Geflügel");
  await is.fill("#category", "Fleisch");
  await is.getByLabel(/OIC\/SMIIC 1:2019/).check();
  for (let i = 0; i < 3; i++) await is.getByRole("button", { name: "Next →" }).click();
  await is.getByLabel(/Dr\. Aisha Rahman/).check();
  await is.getByRole("button", { name: "Save draft" }).click();
  check(await msg(is, "Draft saved"), "issuer: draft saved");
  await is.waitForURL(/\/edit$/);
  check(is.url().includes("/edit"), "URL switches to the saved draft");
  await is.getByRole("button", { name: "Save draft" }).click();
  await msg(is, "Draft saved");
  await is.waitForTimeout(500);
  check((await one(`SELECT count(*)::int c FROM "Company" WHERE name='Neue Halal Metzgerei e.K.'`)).c === 1, "saving twice creates the new company only once");
  check((await one(`SELECT count(*)::int c FROM "Certificate" c JOIN "Company" co ON co.id=c."companyId" WHERE co.name='Neue Halal Metzgerei e.K.'`)).c === 1, "saving twice keeps one draft");
  live = await (async () => { await is.waitForTimeout(900); return is.frameLocator("iframe").locator("body").innerText(); })();
  check(Boolean(live) && (await is.frameLocator("iframe").locator(".qr svg").count()) === 1, "after the first save the preview shows the real QR code");
  await is.getByRole("button", { name: "Next →" }).click();
  check((await is.getByRole("button", { name: "Save and issue" }).count()) === 0 && (await is.getByRole("main").innerText()).includes("an admin checks and issues it"), "issuer: no issue button, hint shown");
  await Promise.all([is.waitForURL(CERT_URL), is.getByRole("button", { name: "Save and submit for approval" }).click()]);
  const idaDraftId = is.url().split("/").pop();
  check((await is.getByRole("main").innerText()).includes("Waiting for an admin"), "issuer: waiting for an admin");
  check((await is.getByRole("button", { name: "Issue certificate" }).count()) === 0 && (await is.getByRole("button", { name: "Suspend" }).count()) === 0, "issuer: no issue/suspend buttons");

  // ── 5. Super admin approves the issuer's draft in the Approvals section ──
  await sa.goto(`${BASE}/admin/approvals`);
  const queue = await sa.getByRole("main").innerText();
  check(queue.includes("Neue Halal Metzgerei e.K.") && queue.includes("Ida Issuer"), "approvals list shows the submitted draft and who submitted it");
  await sa.locator("li", { hasText: "Neue Halal Metzgerei e.K." }).getByRole("link", { name: "Review" }).click();
  await sa.waitForURL(`${BASE}/admin/approvals/${idaDraftId}`);
  await sa.frameLocator("iframe").locator("html[data-ready='1']").waitFor({ state: "attached", timeout: 15000 });
  check((await sa.getByRole("main").innerText()).includes("Everything required for issuing is complete"), "approval window: preview + complete checklist");
  await Promise.all([sa.waitForURL(`${BASE}/admin/certificates/${idaDraftId}`, { timeout: 60000 }), sa.getByRole("button", { name: "Approve and issue" }).click()]);
  check((await one(`SELECT status FROM "Certificate" WHERE id=$1`, [idaDraftId]))?.status === "ACTIVE", "super admin approves and issues the issuer's draft");
  await sa.goto(`${BASE}/admin/approvals`);
  check((await sa.getByRole("main").innerText()).includes("Nothing is waiting for approval"), "approvals list is empty afterwards");
  const issued = await one(`SELECT * FROM "Certificate" WHERE id=$1`, [idaDraftId]);
  check(issued.status === "ACTIVE" && /^H-202026\.\d{4}-1$/.test(issued.certificateNumber) && !["H-202026.0001-1", "H-202026.0002-1"].includes(issued.certificateNumber), `number allocated: ${issued.certificateNumber}`);
  check(issued.issuedById === saId && issued.issuedAt && issued.snapshot?.certificateNumber === issued.certificateNumber, "issuer, time and frozen snapshot recorded");
  const storedPdf = fs.readFileSync(path.join(env.storageDir, issued.pdfKey));
  check(sha256(storedPdf) === issued.pdfSha256, "PDF stored with matching SHA-256");
  const filesUrl = `${BASE}/admin/certificates/${idaDraftId}/files`;
  const dl = await sa.request.get(`${filesUrl}/certificate.pdf`);
  check(sha256(await dl.body()) === issued.pdfSha256, "download = stored PDF");
  const qrUrl = decodeQr(await (await sa.request.get(`${filesUrl}/certificate.png`)).body());
  check(qrUrl === `${BASE}/v/${issued.publicToken}`, "QR code on the issued certificate points to /v/{token}");
  check((await one(`SELECT count(*)::int c FROM "AuditLog" WHERE action='certificate.issue' AND "entityId"=$1`, [idaDraftId])).c === 1, "issue audited");

  // ── 6. Suspend / reactivate ──
  await sa.goto(`${BASE}/admin/certificates/${idaDraftId}`);
  await sa.getByRole("button", { name: "Suspend" }).click();
  await sa.fill("#workflow-reason", "Audit überfällig");
  await sa.getByRole("button", { name: "Confirm" }).click();
  check((await waitDb(`SELECT status, "suspendReason" FROM "Certificate" WHERE id=$1`, [idaDraftId], (r) => r[0].status === "SUSPENDED"))[0].suspendReason === "Audit überfällig", "suspended with reason");
  await sa.getByText("Suspended because").first().waitFor();
  await sa.getByRole("button", { name: "Reactivate" }).click();
  await sa.fill("#workflow-reason", "ab");
  await sa.evaluate(() => document.querySelector("#workflow-reason")!.removeAttribute("minlength"));
  await sa.getByRole("button", { name: "Confirm" }).click();
  check(await msg(sa, "Please give a reason"), "too-short reason rejected server-side");
  await sa.fill("#workflow-reason", "Audit nachgeholt");
  await sa.getByRole("button", { name: "Confirm" }).click();
  check((await waitDb(`SELECT status FROM "Certificate" WHERE id=$1`, [idaDraftId], (r) => r[0].status === "ACTIVE"))[0].status === "ACTIVE", "reactivated");

  // ── 7. Four-eyes off → revision by the super admin ──
  await sa.goto(`${BASE}/admin/settings`);
  await sa.locator('input[name="fourEyes"]').uncheck();
  await sa.getByRole("button", { name: "Save settings" }).click();
  check(await msg(sa, "Settings saved"), "four-eyes principle switched off");
  await sa.goto(`${BASE}/admin/certificates/${idaDraftId}`);
  await Promise.all([sa.waitForURL(/\/edit$/), sa.getByRole("button", { name: "New revision (correction)" }).click()]);
  const revId = sa.url().split("/").slice(-2)[0];
  check((await sa.getByRole("main").innerText()).includes(`Revision 1 of ${issued.certificateNumber}`), "revision draft opens with a revision note");
  await sa.getByRole("button", { name: "3. Products" }).click();
  await sa.getByRole("button", { name: "+ Add product" }).click();
  await sa.getByLabel("Product 1", { exact: true }).fill("Hähnchenbrust");
  await sa.getByRole("button", { name: "6. Review" }).click();
  await Promise.all([sa.waitForURL(CERT_URL, { timeout: 60000 }), sa.getByRole("button", { name: "Save and issue" }).click()]);
  const rev = await one(`SELECT * FROM "Certificate" WHERE id=$1`, [revId]);
  const old = await one(`SELECT * FROM "Certificate" WHERE id=$1`, [idaDraftId]);
  check(rev.status === "ACTIVE" && rev.revision === 1 && rev.certificateNumber === issued.certificateNumber, "revision 1 issued with the same number");
  check(rev.publicToken !== old.publicToken && rev.pdfKey.includes("rev-1"), "revision has its own token and PDF");
  check(old.status === "SUPERSEDED" && old.supersededById === rev.id, "previous revision superseded and linked");
  const revPage = await sa.getByRole("main").innerText();
  check(revPage.includes("Revisions") && revPage.includes("Original") && revPage.includes("Superseded"), "revisions list on the certificate page");

  // ── 8. Revoke, renew, delete draft ──
  await sa.getByRole("button", { name: "Revoke" }).click();
  await sa.fill("#workflow-reason", "Betrieb eingestellt");
  await sa.getByRole("button", { name: "Confirm" }).click();
  check((await waitDb(`SELECT status, "revokeReason" FROM "Certificate" WHERE id=$1`, [revId], (r) => r[0].status === "REVOKED"))[0].revokeReason === "Betrieb eingestellt", "revoked with reason");
  await sa.getByText("Revoked because").first().waitFor();
  check((await sa.getByRole("button", { name: "Suspend" }).count()) === 0 && (await sa.getByRole("button", { name: "New revision (correction)" }).count()) === 0, "revoked: no suspend / revision");
  await Promise.all([sa.waitForURL(/\/edit$/), sa.getByRole("button", { name: "Renew / copy as new draft" }).click()]);
  const renewId = sa.url().split("/").slice(-2)[0];
  const renew = await one(`SELECT *, to_char("issueDate",'YYYY-MM-DD') i, to_char("validUntil",'YYYY-MM-DD') v FROM "Certificate" WHERE id=$1`, [renewId]);
  check(renew.status === "DRAFT" && !renew.certificateNumber && renew.i === today && renew.v === addMonths(today, 24), "renewal draft: no number, today + 24 months");
  await sa.goto(`${BASE}/admin/certificates/${renewId}`);
  await Promise.all([sa.waitForURL(`${BASE}/admin/certificates`), sa.getByRole("button", { name: "Delete draft" }).click()]);
  check(!(await one(`SELECT id FROM "Certificate" WHERE id=$1`, [renewId])) && (await one(`SELECT count(*)::int c FROM "AuditLog" WHERE action='certificate.draft.delete' AND "entityId"=$1`, [renewId])).c === 1, "draft deleted (audited)");

  // Returned super-admin draft can be issued now (four-eyes off)
  await sa.goto(`${BASE}/admin/certificates/${saDraftId}`);
  await sa.getByRole("button", { name: "Issue certificate" }).click();
  check(await msg(sa, "has been issued", 60000), "own draft issued with four-eyes off");
  const frozen = await one(`SELECT "templateVersion" v, snapshot->>'companyLogoKey' logo FROM "Certificate" WHERE id=$1`, [saDraftId]);
  check(frozen?.v === 2 && frozen?.logo === logoKey, "issued with template v2; company logo frozen in the snapshot");
  const saIssued = await one(`SELECT "certificateNumber" n, status FROM "Certificate" WHERE id=$1`, [saDraftId]);
  check(saIssued.status === "ACTIVE" && saIssued.n !== issued.certificateNumber, `second number allocated: ${saIssued.n}`);
  await sa.goto(`${BASE}/admin/companies/${company.id}`);
  check((await sa.getByRole("button", { name: "Delete company" }).count()) === 0, "company with certificates cannot be deleted");

  // ── 9. List filters + export ──
  await sa.goto(`${BASE}/admin/certificates?q=Sesamring`);
  let listText = await sa.getByRole("main").innerText();
  check(listText.includes(saIssued.n) && listText.includes("1 certificate"), "search by product name");
  await sa.goto(`${BASE}/admin/certificates?status=REVOKED`);
  listText = await sa.getByRole("main").innerText();
  check(listText.includes("H-202026.0002-1") && listText.includes(`${issued.certificateNumber} / Rev. 1`) && !listText.includes(saIssued.n), "status filter: revoked");
  await sa.goto(`${BASE}/admin/certificates?status=EXPIRED`);
  check((await sa.getByRole("main").innerText()).includes("H-202024.0001-1"), "status filter: expired");
  const csv = await sa.request.get(`${BASE}/admin/certificates/export?format=csv&status=ACTIVE`);
  const csvText = (await csv.body()).toString("utf8");
  check(csv.status() === 200 && csvText.startsWith("﻿Certificate number;") && csvText.includes(saIssued.n) && !csvText.includes("H-202024.0001-1"), "CSV export with filters (BOM, ; separated)");
  check(csvText.includes(`${BASE}/v/`), "CSV export contains verification URLs");
  const xl = await sa.request.get(`${BASE}/admin/certificates/export?format=xlsx`);
  const xlBody = await xl.body();
  check(xl.status() === 200 && xlBody.subarray(0, 2).toString() === "PK" && (xl.headers()["content-disposition"] || "").includes(".xlsx"), "Excel export");
  check((await one(`SELECT count(*)::int c FROM "AuditLog" WHERE action='certificate.export'`)).c === 2, "exports audited");
  const anonExport = await fetch(`${BASE}/admin/certificates/export?format=csv`, { redirect: "manual" });
  check(anonExport.status === 307, "export requires sign-in");

  // ── 10. Legacy import ──
  await sa.goto(`${BASE}/admin/import`, { waitUntil: "networkidle" });
  const header = "Zertifikatsnummer;Firma;Adresse;PLZ;Ort;Land;Geltungsbereich;Normen;Produkte;Ausstellungsdatum;Gültig bis;Status";
  await sa.setInputFiles("#legacy-file", fixture("bad.csv", `${header}\nH-202022.0010-1;Alt GmbH;Weg 1;80331;München;DE;Fleisch;XYZ 1;;01.01.2022;31.12.2024;ACTIVE\nH-202022.0011-1;Alt GmbH;Weg 1;80331;München;DE;Fleisch;OIC/SMIIC 1:2019;;31.02.2022;31.12.2024;ACTIVE\n`));
  await sa.getByRole("button", { name: "Check file" }).click();
  check(await msg(sa, "2 rows have problems"), "invalid legacy file: problems listed");
  const problemsText = await sa.getByRole("main").innerText();
  check(problemsText.includes("unknown standard(s): XYZ 1") && problemsText.includes('invalid issue date "31.02.2022"'), "problems name line and cause");
  check((await sa.getByRole("button", { name: /^Import \d/ }).count()) === 0, "no import button while problems exist");
  const good = `${header}\nH-202025.0077-1;Alte Firma GmbH;Weg 1;80331;München;DE;Fleischverarbeitung;OIC/SMIIC 1:2019;Sucuk|Pastırma;15.01.2025;14.01.2027;ACTIVE\nH-202019.0005-1;Alte Firma GmbH;Weg 1;80331;München;DE;Fleischverarbeitung;OIC/SMIIC 1:2019|MS 1500:2019;;01.02.2019;31.01.2022;widerrufen\nH-202025.0078-1;Testfirma Halal Bakery GmbH;Backstraße 5;10115;Berlin;DE;Backwaren;MS 1500:2019;;2025-03-01;2027-02-28;ACTIVE\n`;
  await sa.setInputFiles("#legacy-file", fixture("good.csv", good));
  await sa.getByRole("button", { name: "Check file" }).click();
  check(await msg(sa, "3 rows are valid"), "valid legacy file checked");
  await sa.getByRole("button", { name: "Import 3 certificates" }).click();
  check(await msg(sa, "3 certificates imported"), "legacy rows imported");
  const legacy = await q(`SELECT c.*, co.name company FROM "Certificate" c JOIN "Company" co ON co.id=c."companyId" WHERE "isLegacy" ORDER BY "certificateNumber"`);
  check(legacy.length === 3 && legacy.every((c) => c.publicToken && c.snapshot && !c.pdfKey), "legacy certificates: token + snapshot, no PDF");
  check(legacy.find((c) => c.certificateNumber === "H-202019.0005-1")?.status === "REVOKED", "status alias “widerrufen” → REVOKED");
  check((await one(`SELECT count(*)::int c FROM "Company" WHERE name='Testfirma Halal Bakery GmbH'`)).c === 1 && (await one(`SELECT count(*)::int c FROM "Company" WHERE name='Alte Firma GmbH'`)).c === 1, "companies matched by name + postal code (no duplicates)");
  check((await one(`SELECT "lastNumber" n FROM "Counter" WHERE year=2025`)).n >= 78, "yearly counter moved past imported numbers");
  await sa.setInputFiles("#legacy-file", fixture("again.csv", good));
  await sa.getByRole("button", { name: "Check file" }).click();
  check(await msg(sa, "3 rows have problems") && (await sa.getByRole("main").innerText()).includes("already exists in the system"), "re-import of the same rows refused");
  const legacyId = legacy.find((c) => c.certificateNumber === "H-202025.0077-1")!.id;
  await sa.goto(`${BASE}/admin/certificates/${legacyId}`);
  const legacyPage = await sa.getByRole("main").innerText();
  check(legacyPage.includes("Imported legacy certificate") && legacyPage.includes("Sucuk") && (await sa.locator("iframe").count()) === 0, "legacy page: note + products, no generated preview");
  check((await sa.request.get(`${BASE}/admin/certificates/${legacyId}/files/certificate.pdf`)).status() === 404, "legacy: no PDF");
  check((await sa.request.get(`${BASE}/admin/certificates/${legacyId}/files/qr.svg`)).status() === 200, "legacy: QR code available");

  // ── 11. Delete an empty company ──
  await sa.goto(`${BASE}/admin/companies/new`);
  await sa.fill("#company-name", "Leere Firma");
  await sa.fill("#company-address", "Nirgendwo 1");
  await Promise.all([sa.waitForURL(COMPANY_URL), sa.getByRole("button", { name: "Save company" }).click()]);
  const emptyId = sa.url().split("/").pop();
  await Promise.all([sa.waitForURL(`${BASE}/admin/companies`), sa.getByRole("button", { name: "Delete company" }).click()]);
  check(!(await one(`SELECT id FROM "Company" WHERE id=$1`, [emptyId])) && (await one(`SELECT count(*)::int c FROM "AuditLog" WHERE action='company.delete' AND "entityId"=$1`, [emptyId])).c === 1, "empty company deleted (audited)");

  // ── 12. Audit trail of one certificate ──
  await sa.goto(`${BASE}/admin/certificates/${idaDraftId}`);
  const hist = await sa.getByRole("main").innerText();
  check(["certificate.draft.create", "certificate.submit", "certificate.issue", "certificate.suspend", "certificate.reactivate", "certificate.supersede"].every((a) => hist.includes(a)) && hist.includes("Audit überfällig"), "certificate history lists the whole life cycle with reasons");

    await end();
});
