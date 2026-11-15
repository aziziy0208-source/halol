import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Hex SHA-256 — used to store session tokens (the DB never holds the raw token). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 256-bit random token, URL-safe. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

const VERSION = "v1";

function key(): Buffer {
  return Buffer.from(serverEnv().TOTP_ENCRYPTION_KEY, "hex");
}

/** AES-256-GCM: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
