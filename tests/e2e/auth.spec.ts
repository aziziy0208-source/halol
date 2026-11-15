import { type Page, test } from "@playwright/test";
import { check, database, SA, totp } from "./helpers";
import { e2eEnvironment } from "./environment";

const env = e2eEnvironment("auth", 3202);
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("admin sign-in: 2FA, lockout, roles, users, audit", async ({ browser }) => {
  const { client: db, q, end } = await database(env.databaseUrl);
  const resetLoginLimits = () => db.query(`DELETE FROM "RateLimitBucket" WHERE key LIKE 'login:%'`);

  // ── 1. Anonymous access, headers ──
  {
    const r = await fetch(`${BASE}/admin/users`, { redirect: "manual" });
    check(r.status === 307 && (r.headers.get("location") ?? "").includes("/admin/login?next=%2Fadmin%2Fusers"), `anonymous /admin/users → login with next (${r.status} ${r.headers.get("location")})`);
    const home = await fetch(`${BASE}/`);
    const h = (k: string) => home.headers.get(k) || "";
    check(h("x-frame-options") === "DENY" && h("x-content-type-options") === "nosniff" && h("content-security-policy").includes("frame-ancestors 'none'") && h("strict-transport-security").includes("max-age") && h("referrer-policy"), "security headers on public pages (XFO, nosniff, CSP, HSTS, Referrer-Policy)");
    const login = await fetch(`${BASE}/admin/login`);
    check((login.headers.get("x-robots-tag") || "").includes("noindex"), "admin responses carry X-Robots-Tag: noindex");
  }

  const newCtx = async () => browser.newContext({ viewport: { width: 1280, height: 900 } });
  const login = async (page: Page, email: string, password: string) => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await Promise.all([page.waitForLoadState("networkidle"), page.click('button[type="submit"]')]);
    await page.waitForTimeout(400);
  };
  const ALERT = '[role="alert"]:not(#__next-route-announcer__)';
  const alertText = async (page: Page) => (await page.locator(ALERT).allInnerTexts()).join(" ").trim();
  // Redirects inside <Suspense> arrive through the stream after "load": wait for the URL.
  const landsOn = async (page: Page, re: RegExp) => page.waitForURL(re, { timeout: 8000 }).then(() => true, () => false);

  // ── 2. Wrong credentials ──
  await resetLoginLimits();
  const saCtx = await newCtx();
  const sa = await saCtx.newPage();

  // Language switch (EN / UZ) on the sign-in page; stored in a cookie on /admin.
  await sa.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await Promise.all([sa.waitForEvent("load"), sa.getByRole("button", { name: /^uz$/i }).click()]);
  await sa.getByRole("heading", { name: "Kirish" }).waitFor();
  check((await sa.locator("main").getAttribute("lang")) === "uz" && (await sa.getByLabel("Parol").count()) === 1, "admin language switch: sign-in page in Uzbek");
  const langCookie = (await saCtx.cookies()).find((c) => c.name === "whu_admin_lang");
  check(langCookie?.value === "uz" && langCookie.path === "/admin" && langCookie.httpOnly, "language stored in an httpOnly cookie on /admin");
  await Promise.all([sa.waitForEvent("load"), sa.getByRole("button", { name: /^en$/i }).click()]);
  await sa.getByRole("heading", { name: "Sign in" }).waitFor();
  await login(sa, SA.email, "definitely-wrong");
  check((await alertText(sa)).includes("Invalid e-mail or password"), "wrong password → generic error");
  await login(sa, "nobody@example.com", "whatever-123456");
  check((await alertText(sa)).includes("Invalid e-mail or password"), "unknown e-mail → same generic error (no account enumeration)");

  // ── 3. Super admin: password OK → forced 2FA setup ──
  await login(sa, SA.email, SA.password);
  check(await landsOn(sa, /\/admin\/2fa\/setup/), `super admin without 2FA is sent to setup (${sa.url()})`);
  const cookie = (await saCtx.cookies()).find((c) => c.name === "whu_admin_session");
  check(cookie && cookie.httpOnly && cookie.sameSite === "Lax" && cookie.path === "/admin", `session cookie httpOnly, SameSite=Lax, Path=/admin (${cookie && cookie.path})`);
  await sa.goto(`${BASE}/admin`);
  check(await landsOn(sa, /\/admin\/2fa\/setup/), "pending session cannot open the dashboard");
  await sa.goto(`${BASE}/admin/2fa/setup`);
  const secret = (await sa.locator("p.select-all").innerText()).replace(/\s/g, "");
  check(/^[A-Z2-7]{32}$/.test(secret), "setup shows a 160-bit base32 secret and a QR code");
  check((await sa.locator('[role="img"] svg').count()) === 1, "QR code SVG rendered");
  await sa.fill("#code", "000000");
  await sa.click('button[type="submit"]');
  await sa.waitForSelector(ALERT);
  check((await alertText(sa)).includes("Invalid"), "wrong setup code rejected");
  await sa.fill("#code", totp(secret));
  await Promise.all([sa.waitForURL(`${BASE}/admin`), sa.click('button[type="submit"]')]);
  check(sa.url() === `${BASE}/admin`, "correct code → dashboard");
  await sa.getByRole("heading", { name: "Dashboard" }).waitFor();
  check((await sa.content()).includes(secret) === false, "2FA secret no longer anywhere in the DOM after sign-in");
  const enc = (await q(`SELECT "totpSecret" FROM "User" WHERE email=$1`, [SA.email]))[0].totpSecret;
  check(enc.startsWith("v1.") && !enc.includes(secret), "TOTP secret stored encrypted (AES-GCM), not in plain text");
  await sa.getByRole("heading", { name: "Dashboard" }).waitFor();
  const dash = await sa.getByRole("main").innerText();
  check(/Active certificates\s*1/.test(dash) && /Expired\s*1/.test(dash) && /Revoked\s*1/.test(dash), "dashboard counts from DB (active 1, expired 1, revoked 1)");
  const saNav = await sa.locator("#admin-sidebar nav").innerText();
  check(["Users", "Settings", "Audit log", "Messages"].every((x) => saNav.includes(x)), "super admin sees Users, Settings, Audit log, Messages");

  // ── 4. Replay protection on next login ──
  const usedCode = totp(secret);
  await sa.locator("#admin-sidebar").getByRole("button", { name: "Sign out" }).click();
  await sa.waitForURL(/\/admin\/login\?signedOut=1/);
  check((await q(`SELECT count(*)::int c FROM "Session" s JOIN "User" u ON u.id=s."userId" WHERE u.email=$1`, [SA.email]))[0].c === 0, "sign-out deletes the session row");
  check(!(await sa.content()).includes("Active certificates"), "no admin content left in the DOM after sign-out");
  await resetLoginLimits();
  await login(sa, SA.email, SA.password);
  check(sa.url().includes("/admin/2fa?") || sa.url().endsWith("/admin/2fa"), "enrolled super admin → code prompt");
  await sa.fill("#code", usedCode);
  await sa.click('button[type="submit"]');
  await sa.waitForSelector(ALERT);
  check((await alertText(sa)).includes("already used"), "replaying the code used at setup is rejected");
  await sa.fill("#code", totp(secret, 1));
  await Promise.all([sa.waitForURL(`${BASE}/admin`), sa.click('button[type="submit"]')]);
  check(sa.url() === `${BASE}/admin`, "next-step code accepted (±30 s drift window)");

  // ── 5. Super admin creates users ──
  await sa.goto(`${BASE}/admin/users`);
  const temp: Record<string, string> = {};
  for (const [name, email, role] of [["Ada Admin", "ada@example.com", "ADMIN"], ["Isa Issuer", "isa@example.com", "ISSUER"], ["Vic Viewer", "vic@example.com", "VIEWER"]]) {
    await sa.fill("#new-name", name);
    await sa.fill("#new-email", email);
    await sa.selectOption("#new-role", role);
    await sa.getByRole("button", { name: "Create user" }).click();
    await sa.waitForSelector("p.select-all");
    temp[email] = (await sa.locator("p.select-all").first().innerText()).trim();
    await sa.goto(`${BASE}/admin/users`);
  }
  check(Object.values(temp).every((p) => /^[0-9A-Za-z]{16}$/.test(p)), "3 users created, temporary passwords shown once");
  const created = await q(`SELECT email, role, "mustChangePassword", left("passwordHash",9) h FROM "User" WHERE email LIKE '%@example.com' AND email <> $1 ORDER BY email`, [SA.email]);
  check(created.length === 3 && created.every((u) => u.mustChangePassword && u.h === "$argon2id"), "new users: argon2id hash, must change password");
  // Duplicate e-mail
  await sa.fill("#new-name", "Dup");
  await sa.fill("#new-email", "ada@example.com");
  await sa.getByRole("button", { name: "Create user" }).click();
  await sa.waitForSelector(ALERT);
  check((await alertText(sa)).includes("already exists"), "duplicate e-mail rejected");
  // Initial password chosen by the super admin (optional field).
  await sa.goto(`${BASE}/admin/users`);
  await sa.fill("#new-name", "Pia Password");
  await sa.fill("#new-email", "pia@example.com");
  await sa.selectOption("#new-role", "VIEWER");
  await sa.fill("#new-password", "short");
  await sa.evaluate(() => document.querySelector("#new-password")!.removeAttribute("minlength"));
  await sa.getByRole("button", { name: "Create user" }).click();
  await sa.waitForSelector(ALERT);
  check((await alertText(sa)).includes("at least 12"), "chosen password shorter than 12 characters rejected");
  await sa.fill("#new-password", "Pia-Startpasswort-2026");
  await sa.getByRole("button", { name: "Create user" }).click();
  await sa.getByText("created with the password you entered").waitFor();
  const pia = (await q(`SELECT "mustChangePassword" m FROM "User" WHERE email='pia@example.com'`))[0];
  check(pia?.m === true && (await sa.locator("p.select-all").count()) === 0, "user created with the chosen password (no temporary password shown, must change it later)");

  // No-JS form fields of the super admin's server-action forms (action refs are not user-specific).
  const decode = (v: string) => v.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const formFields = (html: string, mustContain: string[]) => {
    const form = (html.match(/<form[\s\S]*?<\/form>/g) || []).find((f) => mustContain.every((m) => f.includes(m)));
    if (!form) return null;
    const fields: Record<string, string> = {};
    for (const [tag] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = (tag.match(/name="([^"]*)"/) || [])[1];
      if (name && name.startsWith("$ACTION")) fields[name] = decode((tag.match(/value="([^"]*)"/) || [])[1] ?? "");
    }
    return fields;
  };
  const usersHtml = await (await sa.request.get(`${BASE}/admin/users`)).text();
  const createFields = formFields(usersHtml, ['name="name"', 'name="email"']);
  const rowFields = formFields(usersHtml, ['name="userId"']);
  check(Boolean(createFields && Object.keys(createFields).length && rowFields && Object.keys(rowFields).length), "found the no-JS action fields of both user forms");
  // Positive control: the same raw request works for the super admin, so the forged test below is meaningful.
  await sa.request.post(`${BASE}/admin/users`, { multipart: { ...createFields, name: "Control User", email: "control@example.com", role: "VIEWER" } });
  check((await q(`SELECT count(*)::int c FROM "User" WHERE email='control@example.com'`))[0].c === 1, "positive control: raw form post as super admin creates a user");

  // ── 6. Viewer: temp password → forced change, restricted navigation ──
  await resetLoginLimits();
  const vCtx = await newCtx();
  const v = await vCtx.newPage();
  await login(v, "vic@example.com", temp["vic@example.com"]);
  check(v.url().includes("/admin/account?required=password"), "temporary password → forced to My account");
  await v.goto(`${BASE}/admin/certificates`);
  check(await landsOn(v, /\/admin\/account/), "other pages blocked until the password is changed");
  await v.fill("#pw-current", temp["vic@example.com"]);
  await v.fill("#pw-next", "short");
  await v.fill("#pw-confirm", "short");
  await v.evaluate(() => document.querySelectorAll("input[minlength]").forEach((i) => i.removeAttribute("minlength")));
  await v.getByRole("button", { name: "Change password" }).click();
  await v.waitForSelector(ALERT);
  check((await alertText(v)).includes("at least 12"), "too-short new password rejected server-side");
  await v.fill("#pw-current", temp["vic@example.com"]);
  await v.fill("#pw-next", "Viewer-Passwort-2026!");
  await v.fill("#pw-confirm", "Viewer-Passwort-2026!");
  await Promise.all([v.waitForURL(`${BASE}/admin`), v.getByRole("button", { name: "Change password" }).click()]);
  check(v.url() === `${BASE}/admin`, "after changing the password the viewer reaches the dashboard");
  await v.getByRole("heading", { name: "Dashboard" }).waitFor();
  const vNav = await v.locator("#admin-sidebar nav").innerText();
  check(vNav.includes("Certificates") && !["Users", "Settings", "Messages", "Audit log", "Import"].some((x) => vNav.includes(x)), `viewer navigation is read-only (${vNav.replace(/\n/g, " | ")})`);
  await v.goto(`${BASE}/admin/users`);
  check((await v.getByRole("main").innerText()).includes("No access"), "viewer opening /admin/users directly → No access");
  // Forged server actions: the viewer replays the super admin's forms (create a super admin; promote itself).
  const vicId = (await q(`SELECT id FROM "User" WHERE email='vic@example.com'`))[0].id;
  await v.request.post(`${BASE}/admin/users`, { multipart: { ...createFields, name: "Evil", email: "evil@example.com", role: "SUPER_ADMIN" } });
  await v.request.post(`${BASE}/admin/users`, { multipart: { ...rowFields, userId: vicId, op: "role", role: "SUPER_ADMIN" } });
  check((await q(`SELECT count(*)::int c FROM "User" WHERE email='evil@example.com'`))[0].c === 0, "forged 'create user' by a viewer is rejected server-side");
  check((await q(`SELECT role FROM "User" WHERE id=$1`, [vicId]))[0].role === "VIEWER", "forged self-promotion to SUPER_ADMIN by a viewer is rejected server-side");

  // ── 7. Lockout after 5 failures ──
  await resetLoginLimits();
  const iCtx = await newCtx();
  const iss = await iCtx.newPage();
  for (let n = 1; n <= 5; n++) await login(iss, "isa@example.com", `wrong-${n}`);
  check((await alertText(iss)).includes("locked"), "5th wrong password locks the account");
  await login(iss, "isa@example.com", temp["isa@example.com"]);
  check((await alertText(iss)).includes("locked"), "correct password is refused while locked");
  // Timestamps are stored as UTC without time zone: compute the remaining time in SQL.
  const minutes = (await q(`SELECT round(extract(epoch FROM ("lockedUntil" - (now() AT TIME ZONE 'UTC'))) / 60)::int AS m FROM "User" WHERE email='isa@example.com'`))[0].m;
  check(minutes >= 14 && minutes <= 15, `lock lasts 15 minutes (${minutes} min left)`);
  // Super admin unlocks
  await sa.goto(`${BASE}/admin/users`);
  const isaCard = sa.locator("li", { hasText: "isa@example.com" });
  check((await isaCard.innerText()).includes("Locked"), "users page shows the lock");
  await isaCard.getByRole("button", { name: "Unlock" }).click();
  await sa.waitForTimeout(800);
  await resetLoginLimits();
  await login(iss, "isa@example.com", temp["isa@example.com"]);
  check(iss.url().includes("/admin/account"), "after unlock the issuer can sign in");

  // ── 8. Admin must set up 2FA; sees messages but not users ──
  await resetLoginLimits();
  const aCtx = await newCtx();
  const ad = await aCtx.newPage();
  await login(ad, "ada@example.com", temp["ada@example.com"]);
  check(ad.url().includes("/admin/2fa/setup"), "ADMIN role is forced into 2FA setup");
  const aSecret = (await ad.locator("p.select-all").innerText()).replace(/\s/g, "");
  await ad.fill("#code", totp(aSecret));
  await Promise.all([ad.waitForURL(/\/admin\/account/), ad.click('button[type="submit"]')]);
  check(ad.url().includes("/admin/account?required=password"), "after 2FA the temporary password must be changed");
  await ad.fill("#pw-current", temp["ada@example.com"]);
  await ad.fill("#pw-next", "Admin-Passwort-2026!");
  await ad.fill("#pw-confirm", "Admin-Passwort-2026!");
  await Promise.all([ad.waitForURL(`${BASE}/admin`), ad.getByRole("button", { name: "Change password" }).click()]);
  await ad.getByRole("heading", { name: "Dashboard" }).waitFor();
  const aNav = await ad.locator("#admin-sidebar nav").innerText();
  check(aNav.includes("Messages") && aNav.includes("Audit log") && !aNav.includes("Users") && !aNav.includes("Settings"), "admin sees Messages + Audit log, not Users/Settings");

  // Messages: mark as read (with audit)
  await db.query(`INSERT INTO "ContactMessage" (id, name, email, message, "isRead", "createdAt") VALUES ('msg1','Erika','erika@example.com','Bitte Angebot für Halal-Zertifizierung.', false, now())`);
  await ad.goto(`${BASE}/admin/messages`);
  await ad.getByRole("button", { name: "Mark as read" }).click();
  await ad.waitForTimeout(800);
  check((await q(`SELECT "isRead" FROM "ContactMessage" WHERE id='msg1'`))[0].isRead === true, "admin marks a message as read");
  check((await ad.getByRole("button", { name: "Mark as unread" }).count()) === 1, "page refreshes after the action");

  // ── 9. Role change and deactivation end sessions immediately ──
  await sa.goto(`${BASE}/admin/users`);
  const vicCard = sa.locator("li", { hasText: "vic@example.com" });
  await vicCard.locator("select").selectOption("ISSUER");
  await vicCard.getByRole("button", { name: "Change role" }).click();
  await sa.waitForTimeout(800);
  check((await q(`SELECT role FROM "User" WHERE email='vic@example.com'`))[0].role === "ISSUER", "super admin changes viewer → issuer");
  await v.goto(`${BASE}/admin`);
  check(await landsOn(v, /\/admin\/login/), "the changed user's old session no longer works");
  sa.once("dialog", (d) => d.accept());
  await sa.locator("li", { hasText: "isa@example.com" }).getByRole("button", { name: "Deactivate" }).click();
  await sa.waitForTimeout(800);
  await iss.goto(`${BASE}/admin`);
  check(await landsOn(iss, /\/admin\/login/), "deactivated user is signed out at once");
  await resetLoginLimits();
  await login(iss, "isa@example.com", temp["isa@example.com"]);
  check((await alertText(iss)).includes("Invalid e-mail or password"), "deactivated user cannot sign in (generic error)");
  check((await sa.locator("li", { hasText: "admin@example.com" }).getByRole("button").count()) === 0, "no self-actions on the own row (cannot demote/deactivate yourself)");

  // ── 10. Audit trail ──
  const actions = (await q(`SELECT action, count(*)::int c FROM "AuditLog" GROUP BY action`)).reduce((m, r) => ({ ...m, [r.action]: r.c }), {});
  const expected = ["auth.login.failure", "auth.login.success", "auth.logout", "auth.lockout", "auth.2fa.failure", "user.2fa.enable", "user.create", "user.unlock", "user.role.change", "user.deactivate", "user.password.change", "message.read"];
  const missing = expected.filter((a) => !actions[a]);
  check(missing.length === 0, `audit log has every action type${missing.length ? " — missing: " + missing.join(", ") : ""}`);
  let auditImmutable = false;
  try { await db.query(`DELETE FROM "AuditLog"`); } catch { auditImmutable = true; }
  check(auditImmutable, "audit entries cannot be deleted");
  await sa.goto(`${BASE}/admin/audit`);
  check((await sa.locator("tbody tr").count()) > 20, "audit log page lists the entries");

    await end();
});
