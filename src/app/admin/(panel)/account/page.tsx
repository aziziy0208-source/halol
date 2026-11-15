import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, buttonClass, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireUser({ allowPendingPasswordChange: true });
  const t = (await adminT());

  return (
    <>
      <PageHeader title={t.account.title} />
      {me.mustChangePassword ? (
        <div className="mb-6">
          <Alert tone="info">{t.account.mustChange}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.account.profile} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-5 text-sm">
            <dt className="text-slate-500">{t.users.name}</dt>
            <dd className="font-medium">{me.name}</dd>
            <dt className="text-slate-500">{t.users.email}</dt>
            <dd className="break-all">{me.email}</dd>
            <dt className="text-slate-500">{t.users.role}</dt>
            <dd>
              <Badge tone="blue">{t.roles[me.role]}</Badge>
            </dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title={t.account.twoFactor} />
          <div className="space-y-3 p-5 text-sm">
            <p>
              <Badge tone={me.totpEnabled ? "green" : "amber"}>
                {me.totpEnabled ? t.account.twoFactorOn : t.account.twoFactorOff}
              </Badge>{" "}
              {me.twoFactorRequired ? <span className="text-slate-500">{t.account.twoFactorRequired}</span> : null}
            </p>
            {!me.totpEnabled ? (
              <Link href="/admin/2fa/setup?next=%2Fadmin%2Faccount" className={buttonClass.secondary}>
                {t.account.enable2fa}
              </Link>
            ) : null}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t.account.changePassword} />
          <PasswordForm
            labels={{
              current: t.account.currentPassword,
              next: t.account.newPassword,
              confirm: t.account.confirmPassword,
              rules: t.account.passwordRules(PASSWORD_MIN_LENGTH),
              submit: t.account.submit,
            }}
          />
        </Card>
      </div>
    </>
  );
}
