"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { adminT } from "@/i18n/admin/server";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/current-user";
import { requestContext } from "@/lib/auth/login";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { ROLES } from "@/lib/auth/permissions";
import { deleteUserSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { randomBase62 } from "@/lib/tokens";

export type UserActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Shown once to the super admin, never stored in plain text. */
  tempPassword?: string;
  /** Entries returned after an error, so the form keeps them (never the password). */
  values?: { name: string; email: string; role: string };
};

const roleSchema = z.enum(ROLES as [Role, ...Role[]]);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  role: roleSchema,
});

function temporaryPassword(): string {
  return randomBase62(16); // ≈95 bits
}

export async function createUserAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const t = (await adminT());
  const auth = await authorize("user.manage");
  if (!auth.ok) return { status: "error", message: t.forbidden.text };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  const values = {
    name: String(formData.get("name") ?? "").slice(0, 120),
    email: String(formData.get("email") ?? "").slice(0, 254),
    role: String(formData.get("role") ?? "").slice(0, 20),
  };
  if (!parsed.success) return { status: "error", message: t.users.errors.invalid, values };
  const { name, email, role } = parsed.data;
  // Optional initial password; empty → a generated temporary password shown once.
  const chosen = String(formData.get("password") ?? "");
  if (chosen && (chosen.length < PASSWORD_MIN_LENGTH || chosen.length > 200)) {
    return { status: "error", message: t.users.errors.passwordShort(PASSWORD_MIN_LENGTH), values };
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { status: "error", message: t.users.errors.emailTaken, values };
  }

  const tempPassword = chosen ? null : temporaryPassword();
  const created = await prisma.user.create({
    data: { name, email, role, passwordHash: await hashPassword(chosen || tempPassword!), mustChangePassword: true },
  });
  const ctx = await requestContext();
  await audit({
    userId: auth.user.id,
    action: "user.create",
    entityType: "User",
    entityId: created.id,
    after: { name, email, role },
    ipHash: ctx.ipHash,
  });
  refresh();
  return tempPassword
    ? { status: "success", message: t.users.created(email), tempPassword }
    : { status: "success", message: t.users.createdWithPassword(email) };
}

const OPS = ["role", "deactivate", "activate", "reset2fa", "unlock", "resetPassword"] as const;
type Op = (typeof OPS)[number];

/** Row actions on an existing user. Each call re-checks the super-admin permission. */
export async function manageUserAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const t = (await adminT());
  const auth = await authorize("user.manage");
  if (!auth.ok) return { status: "error", message: t.forbidden.text };
  const actor = auth.user;

  const op = z.enum(OPS).safeParse(formData.get("op"));
  const userId = z.string().min(1).safeParse(formData.get("userId"));
  if (!op.success || !userId.success) return { status: "error", message: t.users.errors.invalid };

  const target = await prisma.user.findUnique({ where: { id: userId.data } });
  if (!target) return { status: "error", message: t.users.errors.notFound };

  // Never lock yourself out.
  const selfBlocked: Op[] = ["role", "deactivate", "reset2fa", "resetPassword"];
  if (target.id === actor.id && selfBlocked.includes(op.data)) return { status: "error", message: t.users.errors.self };

  let newRole: Role | undefined;
  if (op.data === "role") {
    const parsedRole = roleSchema.safeParse(formData.get("role"));
    if (!parsedRole.success) return { status: "error", message: t.users.errors.invalid };
    newRole = parsedRole.data;
    if (newRole === target.role) return { status: "success", message: t.users.done };
  }

  // At least one active super admin must remain.
  const removesSuperAdmin =
    target.role === "SUPER_ADMIN" &&
    target.isActive &&
    (op.data === "deactivate" || (op.data === "role" && newRole !== "SUPER_ADMIN"));
  if (removesSuperAdmin) {
    const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: target.id } } });
    if (others === 0) return { status: "error", message: t.users.errors.lastSuperAdmin };
  }

  const ctx = await requestContext();
  const log = (action: string, before?: object, after?: object) =>
    audit({ userId: actor.id, action, entityType: "User", entityId: target.id, before, after, ipHash: ctx.ipHash });

  let result: UserActionState = { status: "success", message: t.users.done };
  switch (op.data) {
    case "role":
      await prisma.user.update({ where: { id: target.id }, data: { role: newRole } });
      await deleteUserSessions(target.id); // new role → new rights and maybe a 2FA requirement
      await log("user.role.change", { role: target.role }, { role: newRole });
      break;
    case "deactivate":
      await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
      await deleteUserSessions(target.id);
      await log("user.deactivate", { isActive: true }, { isActive: false });
      break;
    case "activate":
      await prisma.user.update({ where: { id: target.id }, data: { isActive: true } });
      await log("user.activate", { isActive: false }, { isActive: true });
      break;
    case "reset2fa":
      await prisma.user.update({
        where: { id: target.id },
        data: { totpSecret: null, totpEnabledAt: null, totpLastUsedStep: null },
      });
      await deleteUserSessions(target.id);
      await log("user.2fa.reset");
      break;
    case "unlock":
      await prisma.user.update({ where: { id: target.id }, data: { lockedUntil: null, failedLoginCount: 0 } });
      await log("user.unlock");
      break;
    case "resetPassword": {
      const tempPassword = temporaryPassword();
      await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, lockedUntil: null, failedLoginCount: 0 },
      });
      await deleteUserSessions(target.id);
      await log("user.password.reset");
      result = { status: "success", message: t.users.passwordReset(target.email), tempPassword };
      break;
    }
  }
  refresh();
  return result;
}
