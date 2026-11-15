"use server";

import { adminT } from "@/i18n/admin/server";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/current-user";
import { requestContext } from "@/lib/auth/login";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "@/lib/auth/password";
import { deleteUserSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export type PasswordFormState = { status: "idle" | "success" | "error"; message?: string; redirectTo?: string };

const PASSWORD_MAX_LENGTH = 200;

export async function changePasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const t = (await adminT()).account;
  const me = await requireUser({ allowPendingPasswordChange: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < PASSWORD_MIN_LENGTH) return { status: "error", message: t.errors.tooShort(PASSWORD_MIN_LENGTH) };
  if (next.length > PASSWORD_MAX_LENGTH) return { status: "error", message: t.errors.tooLong };
  if (next !== confirm) return { status: "error", message: t.errors.mismatch };
  if (next === current) return { status: "error", message: t.errors.same };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, current))) return { status: "error", message: t.errors.wrongCurrent };

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  await deleteUserSessions(me.id, me.sessionId); // other devices are signed out
  const ctx = await requestContext();
  await audit({ userId: me.id, action: "user.password.change", entityType: "User", entityId: me.id, ipHash: ctx.ipHash });

  // After a forced change the whole panel (navigation included) must be rebuilt: full reload.
  if (me.mustChangePassword) return { status: "success", message: t.changed, redirectTo: "/admin" };
  return { status: "success", message: t.changed };
}
