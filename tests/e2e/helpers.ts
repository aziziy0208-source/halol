import { createHash, createHmac, randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import jsQR from "jsqr";
import { Client } from "pg";
import { PNG } from "pngjs";

/** Shared helpers of the e2e specs. */

/** Seeded super admin; the password is random per run (never in the repo). */
export const SA = {
  email: "admin@example.com",
  password: (process.env.E2E_SA_PASSWORD ||= randomBytes(12).toString("hex")),
};

/** A labelled assertion that does not stop the test (all failures are reported together). */
export function check(ok: unknown, label: string): void {
  expect.soft(Boolean(ok), label).toBe(true);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- database rows in tests
export type Row = Record<string, any>;

export async function database(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  const q = async <T extends Row = Row>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[];
  const one = async <T extends Row = Row>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0];
  /** Polls until `ok(rows)` or the timeout; returns the last rows. */
  const waitDb = async (sql: string, params: unknown[], ok: (rows: Row[]) => boolean, timeout = 30_000) => {
    const end = Date.now() + timeout;
    for (;;) {
      const rows = await q(sql, params);
      if (ok(rows) || Date.now() > end) return rows;
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  return { client, q, one, waitDb, end: () => client.end() };
}

/** Independent RFC 6238 implementation (not the app's code). */
function base32(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of secret.replace(/\s/g, "").toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totp(secret: string, offset = 0): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const h = createHmac("sha1", base32(secret)).update(message).digest();
  const o = h[19]! & 15;
  return String((((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!) % 1e6).padStart(6, "0");
}

export const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export function decodeQr(png: Buffer): string | null {
  const img = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null;
}

/** Today's calendar date in Berlin, YYYY-MM-DD. */
export const berlinToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
