"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminT } from "@/i18n/admin/server";
import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret, randomToken } from "@/lib/auth/crypto";
import { getSession } from "@/lib/auth/current-user";
import {
  isLocked,
  minutesUntil,
  registerFailedAttempt,
  registerSuccessfulLogin,
  requestContext,
  safeNextPath,
} from "@/lib/auth/login";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requiresTwoFactor } from "@/lib/auth/permissions";
import { clearSessionCookie, createSession, sessionIdFromCookie } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Auth steps end with a full page load (redirectTo, handled by the form) instead of a
 * client-side redirect: with Cache Components the router keeps previous pages alive
 * in hidden <Activity> trees, and the 2FA secret or admin data must not linger in the DOM.
 */
export type AuthFormState = { error?: string; redirectTo?: string };

const LOGIN_IP_LIMIT = 20;
const LOGIN_IP_WINDOW_SECONDS = 15 * 60;

// Verifying against a throw-away hash makes "unknown e-mail" take as long as
// "wrong password", so response times don't reveal which accounts exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomToken()));

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254),
  password: z.string().min(1).max(500),
});

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = (await adminT());
  const next = safeNextPath(formData.get("next"));
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: t.login.invalid };
  const { email, password } = parsed.data;
  const ctx = await requestContext();

  const limit = await consumeRateLimit(`login:${ctx.ipHash}`, LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_SECONDS);
  if (!limit.allowed) return { error: t.login.rateLimited };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    await verifyPassword(await getDummyHash(), password);
    await audit({
      userId: null,
      action: "auth.login.failure",
      entityType: "User",
      entityId: user?.id ?? "unknown",
      after: { email, reason: user ? "inactive" : "unknown-email" },
      ipHash: ctx.ipHash,
    });
    return { error: t.login.invalid };
  }

  if (isLocked(user)) {
    await audit({ userId: null, action: "auth.login.blocked", entityType: "User", entityId: user.id, ipHash: ctx.ipHash });
    return { error: t.login.locked(minutesUntil(user.lockedUntil!)) };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const lockedUntil = await registerFailedAttempt(user, "password", ctx.ipHash);
    return { error: lockedUntil ? t.login.locked(minutesUntil(lockedUntil)) : t.login.invalid };
  }

  // Never reuse a session that existed before authentication (session fixation).
  const previous = await sessionIdFromCookie();
  if (previous) await prisma.session.deleteMany({ where: { id: previous } });

  if (requiresTwoFactor(user)) {
    await createSession({ userId: user.id, twoFactorVerified: false, ...ctx });
    await audit({ userId: user.id, action: "auth.password.ok", entityType: "User", entityId: user.id, ipHash: ctx.ipHash });
    const step = user.totpEnabledAt ? "/admin/2fa" : "/admin/2fa/setup";
    return { redirectTo: `${step}?next=${encodeURIComponent(next)}` };
  }

  await createSession({ userId: user.id, twoFactorVerified: true, ...ctx });
  await registerSuccessfulLogin(user.id, ctx.ipHash);
  return { redirectTo: user.mustChangePassword ? "/admin/account?required=password" : next };
}

const codeSchema = z.string().trim().regex(/^\d{6}$/);

/** Second step of the login: the 6-digit code of an already enrolled authenticator. */
export async function verifyTwoFactorAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = (await adminT());
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { user } = session;
  if (session.twoFactorVerified || !user.totpSecret) redirect("/admin");
  const ctx = await requestContext();

  if (isLocked(user)) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    await clearSessionCookie();
    return { error: t.login.locked(minutesUntil(user.lockedUntil!)) };
  }

  const code = codeSchema.safeParse(formData.get("code"));
  const check = code.success ? verifyTotp(decryptSecret(user.totpSecret), code.data, user.totpLastUsedStep) : null;
  // Atomic replay guard: only one request can consume a given time step.
  const accepted =
    check?.ok &&
    (
      await prisma.user.updateMany({
        where: { id: user.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: check.step } }] },
        data: { totpLastUsedStep: check.step },
      })
    ).count === 1;

  if (!accepted || !check?.ok) {
    const lockedUntil = await registerFailedAttempt(user, "totp", ctx.ipHash);
    if (lockedUntil) {
      await clearSessionCookie();
      return { error: t.login.locked(minutesUntil(lockedUntil)) };
    }
    return { error: t.twoFactor.invalid };
  }

  // New session id once fully authenticated.
  await prisma.session.deleteMany({ where: { id: session.id } });
  await createSession({ userId: user.id, twoFactorVerified: true, ...ctx });
  await registerSuccessfulLogin(user.id, ctx.ipHash);
  return {
    redirectTo: user.mustChangePassword ? "/admin/account?required=password" : safeNextPath(formData.get("next")),
  };
}

/** Confirms a new authenticator: the secret was generated by the setup page and kept in the session. */
export async function confirmTotpSetupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = (await adminT());
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { user } = session;
  // An existing authenticator is never replaced from here — that needs a super admin reset.
  if (user.totpEnabledAt) redirect(session.twoFactorVerified ? "/admin" : "/admin/2fa");
  if (!session.pendingTotpSecret) redirect("/admin/2fa/setup");
  const ctx = await requestContext();

  if (isLocked(user)) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    await clearSessionCookie();
    return { error: t.login.locked(minutesUntil(user.lockedUntil!)) };
  }

  const secret = decryptSecret(session.pendingTotpSecret);
  const code = codeSchema.safeParse(formData.get("code"));
  const check = code.success ? verifyTotp(secret, code.data, null) : null;
  if (!check?.ok) {
    const lockedUntil = await registerFailedAttempt(user, "totp", ctx.ipHash);
    if (lockedUntil) {
      await clearSessionCookie();
      return { error: t.login.locked(minutesUntil(lockedUntil)) };
    }
    return { error: t.twoFactor.invalid };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(secret), totpEnabledAt: new Date(), totpLastUsedStep: check.step },
  });
  await audit({ userId: user.id, action: "user.2fa.enable", entityType: "User", entityId: user.id, ipHash: ctx.ipHash });

  const wasLogin = !session.twoFactorVerified;
  await prisma.session.deleteMany({ where: { id: session.id } });
  await createSession({ userId: user.id, twoFactorVerified: true, ...ctx });
  if (wasLogin) await registerSuccessfulLogin(user.id, ctx.ipHash);

  if (user.mustChangePassword) return { redirectTo: "/admin/account?required=password" };
  return { redirectTo: wasLogin ? safeNextPath(formData.get("next")) : "/admin/account" };
}

/** Ends the session. The caller reloads the page (see LogoutButton) to drop all client state. */
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    const ctx = await requestContext();
    await audit({ userId: session.userId, action: "auth.logout", entityType: "User", entityId: session.userId, ipHash: ctx.ipHash });
  }
  await clearSessionCookie();
}
