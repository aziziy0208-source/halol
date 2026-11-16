import type { Role } from "@/generated/prisma/enums";

/**
 * Role → permission matrix (spec §7.2). Every page and server action checks a
 * permission, never a role directly, so the matrix is the single source of truth.
 */
const ALL: readonly Role[] = ["SUPER_ADMIN", "ADMIN", "ISSUER", "VIEWER"];
const ISSUERS: readonly Role[] = ["SUPER_ADMIN", "ADMIN", "ISSUER"];
const ADMINS: readonly Role[] = ["SUPER_ADMIN", "ADMIN"];
const SUPER: readonly Role[] = ["SUPER_ADMIN"];

export const PERMISSIONS = {
  "dashboard.view": ALL,
  "certificate.view": ALL,
  /** Create and edit drafts, submit for approval. */
  "certificate.edit": ISSUERS,
  /** Issue, suspend, reactivate, revoke, new revision; approve ISSUER drafts. */
  "certificate.issue": ADMINS,
  "company.view": ALL,
  /** New company while creating a draft. */
  "company.create": ISSUERS,
  "company.edit": ADMINS,
  "import.run": ADMINS,
  /** Contact-form messages contain personal data: admins only (DSGVO data minimisation). */
  "message.view": ADMINS,
  "audit.view": ADMINS,
  "settings.manage": SUPER,
  "user.manage": SUPER,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Roles that must use two-factor authentication (spec §7.1). */
export const TWO_FACTOR_REQUIRED_ROLES: readonly Role[] = ["SUPER_ADMIN", "ADMIN"];

/**
 * The operator can switch the role requirement off with REQUIRE_2FA=false (sign-in with
 * e-mail and password only). Users who set up an authenticator keep using it.
 */
export function twoFactorRequiredForRoles(): boolean {
  return process.env.REQUIRE_2FA !== "false";
}

export function requiresTwoFactor(user: { role: Role; totpEnabledAt: Date | null }): boolean {
  return (twoFactorRequiredForRoles() && TWO_FACTOR_REQUIRED_ROLES.includes(user.role)) || user.totpEnabledAt !== null;
}

export const ROLES: readonly Role[] = ALL;
