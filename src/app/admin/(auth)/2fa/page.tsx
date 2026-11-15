import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HardRedirect } from "@/components/admin/hard-redirect";
import { buttonClass, Spinner } from "@/components/admin/ui";
import { adminT } from "@/i18n/admin/server";
import { getSession } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/login";
import { CodeForm, LogoutButton } from "../forms";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function TwoFactorPage({ searchParams }: PageProps<"/admin/2fa">) {
  return (
    <Suspense fallback={<Spinner />}>
      <TwoFactorStep searchParams={searchParams} />
    </Suspense>
  );
}

async function TwoFactorStep({ searchParams }: Pick<PageProps<"/admin/2fa">, "searchParams">) {
  const t = (await adminT()).twoFactor;
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const next = safeNextPath((await searchParams).next);
  // Also reached right after a successful code (the action re-renders this page): full reload onwards.
  if (session.twoFactorVerified) {
    const to = session.user.mustChangePassword ? "/admin/account?required=password" : next;
    return <HardRedirect to={to} label={(await adminT()).common.redirecting} />;
  }
  if (!session.user.totpEnabledAt) redirect("/admin/2fa/setup");

  return (
    <>
      <h1 className="mb-1 font-sans text-xl font-semibold text-slate-900">{t.title}</h1>
      <p className="mb-5 text-sm text-slate-500">{t.prompt}</p>
      <CodeForm mode="verify" next={next} labels={{ code: t.code, submit: t.submit, submitting: t.submitting }} />
      <div className="mt-4 text-center">
        <LogoutButton label={t.signOut} className={buttonClass.link} />
      </div>
    </>
  );
}
