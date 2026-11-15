import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { can, type Permission, requiresTwoFactor } from "./permissions";
import { loadSession, sessionIdFromCookie } from "./session";

/**
 * Data Access Layer for authentication. Every admin page and server action
 * goes through requireUser()/authorize(); nothing trusts the proxy alone.
 * Deliberately NOT cached across requests: a deactivated user or a changed
 * role must take effect on the very next request.
 */

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
  twoFactorRequired: boolean;
  mustChangePassword: boolean;
  sessionId: string;
};

/**
 * Current session, read fresh on every call. Deliberately not wrapped in React
 * cache(): a server action and the render of its redirect target share one
 * request, so a memoised session would still show the state from before the
 * action (e.g. "must change password" right after the password was changed).
 * The cost is one primary-key lookup per call.
 */
export async function getSession() {
  const id = await sessionIdFromCookie();
  return id ? loadSession(id) : null;
}

type RequireOptions = {
  /** The account page itself must stay reachable while a password change is pending. */
  allowPendingPasswordChange?: boolean;
};

/** Signed-in, fully verified user — or a redirect to the right step. */
export async function requireUser(options: RequireOptions = {}): Promise<AdminUser> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { user } = session;
  const twoFactorRequired = requiresTwoFactor(user);
  if (twoFactorRequired && !session.twoFactorVerified) {
    redirect(user.totpEnabledAt ? "/admin/2fa" : "/admin/2fa/setup");
  }
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect("/admin/account?required=password");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    totpEnabled: user.totpEnabledAt !== null,
    twoFactorRequired,
    mustChangePassword: user.mustChangePassword,
    sessionId: session.id,
  };
}

export type Authorized = { ok: true; user: AdminUser } | { ok: false; user: AdminUser };

/** For server actions: re-checks the session and the permission on every call. */
export async function authorize(permission: Permission): Promise<Authorized> {
  const user = await requireUser();
  return { ok: can(user.role, permission), user };
}
