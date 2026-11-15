import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/admin/ui";
import { adminT } from "@/i18n/admin/server";
import { safeNextPath } from "@/lib/auth/login";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const t = (await adminT()).login;
  return (
    <>
      <h1 className="mb-1 font-sans text-xl font-semibold text-slate-900">{t.title}</h1>
      <p className="mb-5 text-sm text-slate-500">{t.subtitle}</p>
      <Suspense fallback={<Spinner />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const t = (await adminT()).login;
  const params = await searchParams;
  const notice = params.signedOut ? t.signedOut : undefined;
  return (
    <LoginForm
      labels={{ email: t.email, password: t.password, submit: t.submit, submitting: t.submitting }}
      next={safeNextPath(params.next)}
      notice={notice}
    />
  );
}
