import { test } from "@playwright/test";
import { check, database, SA } from "./helpers";
import { e2eEnvironment } from "./environment";

// Operator switch REQUIRE_2FA=false: admins sign in with e-mail and password only.
const env = e2eEnvironment("auth-no2fa", 3208, { REQUIRE_2FA: "false" });
const BASE = env.base;

test.beforeAll(() => env.start());
test.afterAll(() => env.stop());

test("REQUIRE_2FA=false: super admin signs in with password only", async ({ browser }) => {
  const { one, end } = await database(env.databaseUrl);
  const page = await browser.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", SA.email);
  await page.fill("#password", SA.password);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click('button[type="submit"]')]);
  check(page.url() === `${BASE}/admin`, "lands on the dashboard without a 2FA step");
  await page.goto(`${BASE}/admin/users`);
  await page.getByRole("heading", { name: "Users", exact: true }).waitFor();
  check(page.url() === `${BASE}/admin/users`, "super admin pages reachable");
  await page.goto(`${BASE}/admin/account`);
  await page.getByRole("heading", { name: "My account" }).first().waitFor();
  check((await page.getByText("Required for your role.").count()) === 0, "account page does not call 2FA required");
  check((await one(`SELECT "totpEnabledAt" FROM "User" WHERE email=$1`, [SA.email])).totpEnabledAt === null, "no authenticator was forced");
  await end();
});
