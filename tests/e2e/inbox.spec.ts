import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { check, database, SA, totp } from "./helpers";
import { e2eEnvironment } from "./environment";

// Received e-mails are normally copied from Resend; here rows are inserted directly
// (no RESEND_API_KEY in tests), so the mailbox UI and its safety rules are tested offline.
const env = e2eEnvironment("inbox", 3206);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("mailbox: received e-mails, sandboxed HTML, attachments, unread badge, delete", async ({ browser }) => {
  const { q, one, end } = await database(env.databaseUrl);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    void d.accept();
  });
  // CSP-blocked requests still emit "request" (then fail with "csp"); only a response means data left the browser.
  const remoteResponses: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("evil.example")) remoteResponses.push(r.url());
  });

  // ── Sign in (fresh DB: 2FA setup) ──
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", SA.password);
  await Promise.all([page.waitForURL(/2fa\/setup/), page.click('button[type="submit"]')]);
  const secret = (await page.locator("p.select-all").innerText()).replace(/\s/g, "");
  await page.fill("#code", totp(secret));
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click('button[type="submit"]')]);

  // ── Empty mailbox, provider not configured ──
  await page.goto(`${BASE}/admin/inbox`);
  await page.getByText("No e-mails yet.").waitFor();
  check(true, "empty mailbox message");
  await page.getByText("RESEND_API_KEY").waitFor({ timeout: 15000 });
  check(true, "missing RESEND_API_KEY explained");

  // ── Two received e-mails (one with an attachment, one failing sender checks) ──
  const key = "inbound/test-provider-1/att-1-Angebot.pdf";
  const pdf = Buffer.from("%PDF-1.4 test attachment");
  fs.mkdirSync(path.join(env.storageDir, path.dirname(key)), { recursive: true });
  fs.writeFileSync(path.join(env.storageDir, key), pdf);
  const html = `<p>Hallo WHU</p><script>alert(1)</script><img src="https://evil.example/pixel.png"><form action="https://evil.example"><button>x</button></form>`;
  await q(
    `INSERT INTO "InboundEmail" (id, "providerId", "fromAddress", "fromName", "to", cc, "replyTo", subject, text, html, attachments, spf, dkim, dmarc, "receivedAt")
     VALUES ('cmailone000000000000000001', 'test-provider-1', 'kunde@example.com', 'Erika Kunde', ARRAY['info@halal-zertifizierung.org'], ARRAY[]::text[], ARRAY[]::text[],
             'Anfrage Zertifizierung', 'Hallo WHU (Text)', $1, $2::jsonb, 'pass', 'pass', 'pass', now() - interval '1 hour'),
            ('cmailtwo000000000000000002', 'test-provider-2', 'spoof@example.net', NULL, ARRAY['info@halal-zertifizierung.org'], ARRAY[]::text[], ARRAY[]::text[],
             'Rechnung', 'Bitte zahlen', NULL, '[]'::jsonb, 'fail', 'fail', 'fail', now())`,
    [html, JSON.stringify([{ id: "att-1", filename: "Angebot.pdf", contentType: "application/pdf", size: pdf.length, inline: false, storageKey: key }])],
  );

  await page.goto(`${BASE}/admin/inbox`);
  const list = page.locator("main ul li");
  check((await list.count()) === 2, "both e-mails listed");
  check((await list.first().innerText()).includes("Rechnung"), "newest first");
  check((await page.locator('nav a[href="/admin/inbox"]').innerText()).includes("2"), "nav badge shows 2 unread");

  // ── Open the first e-mail: sandboxed HTML ──
  await page.click("text=Anfrage Zertifizierung");
  await page.waitForURL(/\/admin\/inbox\/cmailone/);
  const frame = page.locator("iframe");
  const sandbox = (await frame.getAttribute("sandbox")) ?? "";
  check(!sandbox.includes("allow-scripts") && !sandbox.includes("allow-same-origin") && !sandbox.includes("allow-forms"), "iframe sandbox: no scripts, same-origin or forms");
  check(((await frame.getAttribute("srcdoc")) ?? "").includes("default-src 'none'"), "CSP inside the e-mail document");
  await page.frameLocator("iframe").getByText("Hallo WHU").waitFor();
  await page.waitForTimeout(500);
  check(dialogs === 0, "script in e-mail did not run");
  check(remoteResponses.length === 0, "remote image not loaded (no tracking)");
  check((await one(`SELECT "isRead" FROM "InboundEmail" WHERE id='cmailone000000000000000001'`)).isRead === true, "opening marks as read");
  check((await page.getByText("Erika Kunde <kunde@example.com>").count()) === 1, "sender shown");

  // ── Attachment download ──
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("text=Angebot.pdf")]);
  const saved = fs.readFileSync((await download.path())!);
  check(saved.equals(pdf), "attachment downloads unchanged");

  // ── Plain-text view ──
  await page.goto(`${BASE}/admin/inbox/cmailone000000000000000001?view=text`);
  await page.getByText("Hallo WHU (Text)").waitFor();
  check(true, "plain-text view");

  // ── Spoofed e-mail warning ──
  await page.goto(`${BASE}/admin/inbox/cmailtwo000000000000000002`);
  await page.getByText("Sender check failed").waitFor();
  check(true, "failed SPF/DKIM/DMARC warning");
  await page.goto(`${BASE}/admin/inbox`);
  await page.locator("main ul li").first().waitFor();
  check((await page.locator('nav a[href="/admin/inbox"]').innerText()).match(/\d/) === null, "no unread badge after both are opened");
  await page.goto(`${BASE}/admin/inbox/cmailtwo000000000000000002`);

  // ── Mark unread → list; delete ──
  await page.getByRole("button", { name: "Mark as unread" }).click();
  await page.waitForURL(`${BASE}/admin/inbox`);
  check((await one(`SELECT "isRead" FROM "InboundEmail" WHERE id='cmailtwo000000000000000002'`)).isRead === false, "marked as unread");
  await page.goto(`${BASE}/admin/inbox/cmailone000000000000000001`);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(`${BASE}/admin/inbox`);
  check((await q(`SELECT 1 FROM "InboundEmail" WHERE id='cmailone000000000000000001'`)).length === 0, "e-mail deleted");
  check(!fs.existsSync(path.join(env.storageDir, key)), "attachment file deleted");
  check((await q(`SELECT 1 FROM "AuditLog" WHERE action='inbox.delete'`)).length === 1, "deletion audited");

  // ── Without a session the attachment route is not reachable ──
  const anon = await browser.newContext();
  const res = await anon.request.get(`${BASE}/admin/inbox/cmailtwo000000000000000002/attachments/x`, { maxRedirects: 0 });
  check([302, 303, 307].includes(res.status()), "anonymous attachment request redirected to login");
  await anon.close();

  await ctx.close();
  await end();
});
