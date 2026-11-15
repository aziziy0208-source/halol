import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite (tests/e2e) against the production build: `npm run test:e2e`.
 * Every spec file starts its own seeded database and server (tests/e2e/environment.ts);
 * they run one after another to keep the machine load predictable.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Locally the throwaway `prisma dev` (PGlite) databases occasionally drop a connection under
  // load; a retry runs in a new worker with a fresh environment and is reported as "flaky".
  // CI uses a real PostgreSQL server: no retries there.
  retries: process.env.CI ? 0 : 1,
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  // A missing element fails the step after 30 s instead of hanging until the test timeout.
  use: { trace: "retain-on-failure", actionTimeout: 30_000, navigationTimeout: 60_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
