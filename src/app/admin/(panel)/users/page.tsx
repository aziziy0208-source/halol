import type { Metadata } from "next";
import { Badge, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { isLocked } from "@/lib/auth/login";
import { can, ROLES } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { CreateUserForm, UserRowActions } from "./user-forms";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireUser();
  if (!can(me.role, "user.manage")) return <Forbidden />;
  const t = (await adminT());
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lockedUntil: true,
      totpEnabledAt: true,
      lastLoginAt: true,
      mustChangePassword: true,
    },
  });
  const roles = ROLES.map((r) => ({ value: r, label: t.roles[r], description: t.roleDescriptions[r] }));

  return (
    <>
      <PageHeader title={t.users.title} subtitle={t.users.subtitle} />

      <Card className="mb-6">
        <CardHeader title={t.users.createTitle} />
        <CreateUserForm
          roles={roles}
          labels={{
            name: t.users.name,
            email: t.users.email,
            role: t.users.role,
            password: t.users.password,
            passwordHint: t.users.passwordHint(12),
            submit: t.users.createSubmit,
            hint: t.users.tempPasswordHint,
          }}
        />
      </Card>

      <ul className="space-y-3">
        {users.map((u) => {
          const locked = isLocked(u);
          const isMe = u.id === me.id;
          return (
            <li key={u.id}>
              <Card className={u.isActive ? "" : "opacity-70"}>
                <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {u.name} {isMe ? <span className="text-xs font-normal text-slate-500">({t.users.you})</span> : null}
                    </p>
                    <p className="truncate text-sm text-slate-600">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="blue">{t.roles[u.role]}</Badge>
                      <Badge tone={u.isActive ? "green" : "neutral"}>{u.isActive ? t.users.active : t.users.inactive}</Badge>
                      {locked ? <Badge tone="red">{t.users.locked}</Badge> : null}
                      <Badge tone={u.totpEnabledAt ? "green" : "amber"}>
                        {t.users.twoFactor}: {u.totpEnabledAt ? t.users.enabled : t.users.off}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {t.users.lastLogin}: {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t.common.never}
                    </p>
                  </div>
                  {!isMe ? (
                    <UserRowActions
                      user={{ id: u.id, role: u.role, isActive: u.isActive, isLocked: locked, totpEnabled: u.totpEnabledAt !== null }}
                      roles={roles}
                      labels={{
                        changeRole: t.users.changeRole,
                        deactivate: t.users.deactivate,
                        activate: t.users.activate,
                        reset2fa: t.users.reset2fa,
                        unlock: t.users.unlock,
                        resetPassword: t.users.resetPassword,
                        confirmReset2fa: t.users.confirmReset2fa,
                        confirmDeactivate: t.users.confirmDeactivate,
                        hint: t.users.tempPasswordHint,
                      }}
                    />
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
