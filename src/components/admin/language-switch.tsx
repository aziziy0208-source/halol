"use client";

import { useTransition } from "react";
import { setAdminLocaleAction } from "@/app/admin/locale-action";
import { ADMIN_LOCALE_NAMES, ADMIN_LOCALES, type AdminLocale } from "@/i18n/admin";
import { useAdminLocale, useAdminMessages } from "@/i18n/admin/client";

/** EN / UZ switch; a full reload afterwards renders every page and form in the new language. */
export function LanguageSwitch({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const current = useAdminLocale();
  const t = useAdminMessages().language;
  const [pending, startTransition] = useTransition();
  const choose = (locale: AdminLocale) =>
    startTransition(async () => {
      await setAdminLocaleAction(locale);
      window.location.reload();
    });
  const base = tone === "dark" ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900";
  const active = tone === "dark" ? "bg-white/15 text-white" : "bg-slate-200 text-slate-900";
  return (
    <div role="group" aria-label={t.label} className="flex items-center gap-1 text-xs font-medium">
      {ADMIN_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          disabled={pending}
          aria-pressed={locale === current}
          title={ADMIN_LOCALE_NAMES[locale]}
          onClick={() => locale !== current && choose(locale)}
          className={`rounded px-2 py-0.5 uppercase ${locale === current ? active : base}`}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
