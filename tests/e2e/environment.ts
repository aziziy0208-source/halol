import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { SA } from "./helpers";

/**
 * One isolated environment per spec file: a NEW database (migrated + seeded) and
 * its own production server on its own port. Nothing is ever reset or dropped:
 *   - E2E_POSTGRES_URL set (CI): `CREATE DATABASE whu_e2e_<spec>_<time>` on that server,
 *   - otherwise: a throwaway `prisma dev` database named whu-e2e-<spec>.
 */

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, ".next", "standalone");

function run(args: string[], env: NodeJS.ProcessEnv): string {
  return execFileSync("npx", args, { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
}

async function createDatabase(name: string): Promise<{ url: string; poolMax?: string; devName?: string }> {
  const admin = process.env.E2E_POSTGRES_URL;
  if (admin) {
    const dbName = `whu_e2e_${name}_${Date.now()}`;
    const client = new Client({ connectionString: admin });
    await client.connect();
    await client.query(`CREATE DATABASE "${dbName}"`);
    await client.end();
    const url = new URL(admin);
    url.pathname = `/${dbName}`;
    return { url: url.toString() };
  }
  const devName = `whu-e2e-${name}`;
  // A leftover instance of an earlier, interrupted run of this suite.
  try {
    run(["prisma", "dev", "stop", devName], process.env);
    run(["prisma", "dev", "rm", devName], process.env);
  } catch {
    // none
  }
  const output = run(["prisma", "dev", "-n", devName, "-d"], process.env);
  const url = output.match(/postgres(?:ql)?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`prisma dev did not print a database URL:\n${output}`);
  // PGlite serves one connection per client reliably: keep the app's pool at 1.
  return { url, poolMax: "1", devName };
}

async function waitForHealth(base: string, server: ChildProcess, log: () => string): Promise<void> {
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    if (server.exitCode !== null) throw new Error(`server exited (${server.exitCode}):\n${log()}`);
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not become healthy:\n${log()}`);
}

/** extraEnv: additional server environment, e.g. { REQUIRE_2FA: "false" }. */
export function e2eEnvironment(name: string, port: number, extraEnv: Record<string, string> = {}) {
  const base = `http://127.0.0.1:${port}`;
  let databaseUrl = "";
  let storageDir = "";
  let devName: string | undefined;
  let server: ChildProcess | null = null;
  let stderr = "";

  return {
    base,
    get databaseUrl() {
      return databaseUrl;
    },
    get storageDir() {
      return storageDir;
    },
    async start(): Promise<void> {
      const db = await createDatabase(name);
      databaseUrl = db.url;
      devName = db.devName;
      storageDir = mkdtempSync(path.join(os.tmpdir(), `whu-e2e-${name}-`));
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: databaseUrl,
        ...(db.poolMax ? { DATABASE_POOL_MAX: db.poolMax } : {}),
        APP_URL: base,
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        STORAGE_DRIVER: "fs",
        STORAGE_DIR: storageDir,
        ...extraEnv,
      };
      run(["prisma", "migrate", "deploy"], env);
      run(["prisma", "db", "seed"], {
        ...env,
        SEED_SUPERADMIN_EMAIL: SA.email,
        SEED_SUPERADMIN_NAME: "Super Admin",
        SEED_SUPERADMIN_PASSWORD: SA.password,
        SEED_DEMO: "true",
      });
      server = spawn(process.execPath, ["server.js"], { cwd: STANDALONE, env, stdio: ["ignore", "ignore", "pipe"] });
      server.stderr?.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-20_000);
      });
      await waitForHealth(base, server, () => stderr);
    },
    async stop(): Promise<void> {
      if (server && server.exitCode === null) {
        const exited = new Promise((r) => server!.once("exit", r));
        server.kill("SIGTERM");
        await exited;
      }
      if (stderr.trim()) console.log(`[${name}] server stderr:\n${stderr}`);
      if (devName) {
        try {
          run(["prisma", "dev", "stop", devName], process.env);
          run(["prisma", "dev", "rm", devName], process.env);
        } catch {
          // best effort
        }
      }
      if (storageDir) rmSync(storageDir, { recursive: true, force: true });
    },
    /** Database client for assertions on the spec's own database. */
    async database() {
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      return client;
    },
  };
}
