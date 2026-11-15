import "server-only";
import { headers } from "next/headers";
import type { User } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/security/ip";
import { deleteUserSessions } from "./session";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIp(h)), userAgent: h.get("user-agent") };
}

export function minutesUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
}

export function isLocked(user: Pick<User, "lockedUntil">): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
}

/**
 * Counts a failed password or 2FA attempt (both share one counter, so a known
 * password does not buy unlimited code guesses). The 5th failure locks the
 * account for 15 minutes and ends any half-finished login.
 * Returns the lock expiry if this attempt caused a lock.
 */
export async function registerFailedAttempt(
  user: Pick<User, "id" | "email">,
  kind: "password" | "totp",
  ipHash: string,
): Promise<Date | null> {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  await audit({
    userId: null,
    action: kind === "password" ? "auth.login.failure" : "auth.2fa.failure",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, attempt: updated.failedLoginCount },
    ipHash,
  });
  if (updated.failedLoginCount < MAX_FAILED_ATTEMPTS) return null;

  const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil } });
  await deleteUserSessions(user.id);
  await audit({
    userId: null,
    action: "auth.lockout",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, lockedUntil: lockedUntil.toISOString() },
    ipHash,
  });
  return lockedUntil;
}

/** Clears the failure counter after a complete (password + 2FA) login. */
export async function registerSuccessfulLogin(userId: string, ipHash: string, extra: { totpStep?: number } = {}) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(extra.totpStep !== undefined ? { totpLastUsedStep: extra.totpStep } : {}),
    },
  });
  await audit({ userId, action: "auth.login.success", entityType: "User", entityId: userId, ipHash });
}

/** Only same-site admin paths are accepted as post-login targets (no open redirect). */
export function safeNextPath(value: unknown): string {
  const path = typeof value === "string" ? value : "";
  return /^\/admin(\/[\w\-/?=&.%]*)?$/.test(path) && !path.startsWith("/admin/login") && !path.startsWith("/admin/2fa")
    ? path
    : "/admin";
}
