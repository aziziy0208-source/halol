import Image from "next/image";
import { type ReactNode, Suspense } from "react";
import { LanguageSwitch } from "@/components/admin/language-switch";
import { Spinner } from "@/components/admin/ui";
import { AdminLocaleProvider } from "@/i18n/admin/client";
import { adminLocale, adminT } from "@/i18n/admin/server";

/** Centered card for sign-in and two-factor steps. The language is read inside <Suspense>. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthFrame>{children}</AuthFrame>
    </Suspense>
  );
}

async function AuthFrame({ children }: { children: ReactNode }) {
  const locale = await adminLocale();
  const t = await adminT();
  return (
    <AdminLocaleProvider locale={locale}>
      <main lang={locale} className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Image src="/assets/brand/whu-logo.png" alt="WHU – World Halal Union" width={123} height={72} priority />
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{t.appName}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
          <div className="mt-4 flex justify-center">
            <LanguageSwitch tone="light" />
          </div>
        </div>
      </main>
    </AdminLocaleProvider>
  );
}
