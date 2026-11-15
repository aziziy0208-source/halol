import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { SESSION_COOKIE_NAME } from "./cookie-name";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

const MINUTE = 60 * 1000;
/** Absolute lifetime of a signed-in session. */
export const SESSION_MAX_AGE_MS = 12 * 60 * MINUTE;
/** Signed out after this much inactivity. */
export const SESSION_IDLE_MS = 2 * 60 * MINUTE;
/** A half-finished login (password OK, 2FA pending) expires quickly. */
export const PENDING_SESSION_MS = 10 * MINUTE;
/** Don't write lastSeenAt on every request. */
const TOUCH_INTERVAL_MS = 5 * MINUTE;

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    // Secure whenever the site runs on HTTPS (always in production).
    secure: serverEnv().APP_URL.startsWith("https://"),
    sameSite: "lax" as const,
    // The admin cookie is never sent to the public site or verification pages.
    path: "/admin",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

type CreateOptions = {
  userId: string;
  twoFactorVerified: boolean;
  userAgent?: string | null;
  ipHash?: string | null;
};

/** Creates a session row, sets the cookie, returns the session id (hash of the token). */
export async function createSession(opts: CreateOptions): Promise<string> {
  const token = randomToken();
  const id = sha256Hex(token);
  const lifetime = opts.twoFactorVerified ? SESSION_IDLE_MS : PENDING_SESSION_MS;
  await prisma.session.create({
    data: {
      id,
      userId: opts.userId,
      twoFactorVerified: opts.twoFactorVerified,
      expiresAt: new Date(Date.now() + lifetime),
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      ipHash: opts.ipHash ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(opts.twoFactorVerified ? SESSION_MAX_AGE_MS : PENDING_SESSION_MS));
  return id;
}

/** Session id (token hash) from the cookie, or null. */
export async function sessionIdFromCookie(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256Hex(token) : null;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
}

/** Loads a valid session with its user; deletes it if expired or the user is inactive. */
export async function loadSession(id: string) {
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  // Sliding idle timeout, capped by the absolute lifetime.
  if (session.twoFactorVerified && now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    const expiresAt = new Date(Math.min(session.createdAt.getTime() + SESSION_MAX_AGE_MS, now + SESSION_IDLE_MS));
    await prisma.session.update({ where: { id }, data: { lastSeenAt: new Date(now), expiresAt } });
  }
  return session;
}

export type LoadedSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

/** Signs the user out everywhere except (optionally) the given session. */
export async function deleteUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
