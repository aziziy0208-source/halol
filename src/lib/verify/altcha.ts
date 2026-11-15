import "server-only";
import { createHmac } from "node:crypto";
import { createChallenge, randomInt, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/sha";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/db";

/**
 * ALTCHA proof-of-work for the manual certificate check (spec §8.3; ALTCHA instead
 * of Turnstile: self-hosted, no cookies, no third-party requests — DSGVO).
 * Deterministic challenges: the browser has to find a random counter (≈ 20–60k
 * SHA-256 hashes, well under a second), the server checks it with one hash.
 * Each solved challenge is accepted once (replay store in Postgres).
 */
const ALGORITHM = "SHA-256";
const EXPIRES_MS = 10 * 60 * 1000;

function secret(purpose: string): string {
  return createHmac("sha256", serverEnv().IP_HASH_SECRET).update(`altcha:${purpose}`).digest("hex");
}

export async function createVerifyChallenge() {
  return createChallenge({
    algorithm: ALGORITHM,
    cost: 1,
    counter: randomInt(20_000, 60_000),
    deriveKey,
    expiresAt: new Date(Date.now() + EXPIRES_MS),
    hmacSignatureSecret: secret("signature"),
    hmacKeySignatureSecret: secret("key"),
  });
}

type ClientPayload = {
  challenge: Parameters<typeof verifySolution>[0]["challenge"];
  solution: Parameters<typeof verifySolution>[0]["solution"];
};

function parsePayload(raw: string): ClientPayload | null {
  try {
    const value = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as unknown;
    if (value && typeof value === "object" && "challenge" in value && "solution" in value && !("verificationData" in value)) {
      return value as ClientPayload;
    }
  } catch {
    // fall through
  }
  return null;
}

/** True if the widget's payload solves one of our challenges that is unexpired and unused. */
export async function verifyAltchaPayload(raw: unknown): Promise<boolean> {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 10_000) return false;
  const payload = parsePayload(raw);
  if (!payload) return false;
  try {
    const result = await verifySolution({
      challenge: payload.challenge,
      solution: payload.solution,
      deriveKey,
      hmacSignatureSecret: secret("signature"),
      hmacKeySignatureSecret: secret("key"),
    });
    if (!result.verified) return false;
  } catch {
    return false;
  }
  // Replay protection: the challenge nonce may be used once until it expires.
  const nonce = String(payload.challenge.parameters.nonce);
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${`altcha-used:${nonce}`}, 1, (now() AT TIME ZONE 'UTC') + interval '15 minutes')
    ON CONFLICT ("key") DO NOTHING
    RETURNING "key"`;
  return rows.length === 1;
}
