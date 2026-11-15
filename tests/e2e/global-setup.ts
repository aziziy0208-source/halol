import { cpSync, existsSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Runs once before the suite: lays out the standalone production build like the
 * Docker image (static assets + the complete playwright-core package) and creates
 * the per-run secrets every spec environment inherits.
 */
export default function globalSetup(): void {
  const root = process.cwd();
  const standalone = path.join(root, ".next", "standalone");
  if (!existsSync(path.join(standalone, "server.js"))) {
    throw new Error("No production build found — run `npm run build` (or `npm run test:e2e`, which builds first).");
  }
  const copies: [string, string][] = [
    [path.join(root, "public"), path.join(standalone, "public")],
    [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
    [path.join(root, "node_modules", "playwright-core"), path.join(standalone, "node_modules", "playwright-core")],
  ];
  for (const [from, to] of copies) {
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
  }
  process.env.IP_HASH_SECRET ||= randomBytes(32).toString("hex");
  process.env.TOTP_ENCRYPTION_KEY ||= randomBytes(32).toString("hex");
  process.env.NEXT_TELEMETRY_DISABLED = "1";
}
