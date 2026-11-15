import { randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
// 248 = 62 * 4: bytes >= 248 are discarded so every character is equally likely.
const UNBIASED_LIMIT = 248;

/** Cryptographically random base62 string without modulo bias. */
export function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= UNBIASED_LIMIT) continue;
      out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

/** 16 base62 chars ≈ 95 bits: not guessable, short enough for a sparse QR code. */
export const PUBLIC_TOKEN_LENGTH = 16;

export function generatePublicToken(): string {
  return randomBase62(PUBLIC_TOKEN_LENGTH);
}

const PUBLIC_TOKEN_RE = new RegExp(`^[0-9A-Za-z]{${PUBLIC_TOKEN_LENGTH}}$`);

export function isPublicToken(value: string): boolean {
  return PUBLIC_TOKEN_RE.test(value);
}
