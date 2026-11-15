import { TitleBar } from "@/components/site/layout-primitives";
import { sitePath } from "@/i18n/site";
import { type VerifyLang, verifyTexts } from "@/i18n/verify";
import { ManualCheckForm } from "./manual-check-form";

/** "Verify a certificate" by number (DE: /zertifikat-pruefen, EN: /en/verify-certificate). */
export function ManualCheckView({ lang }: { lang: VerifyLang }) {
  const t = verifyTexts(lang);
  const other = lang === "de" ? "en" : "de";
  const switchHref = other === "en" ? sitePath("check", "en") : `${sitePath("check", "de")}?lang=de`;
  return (
    <div lang={lang}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TitleBar title={t.manual.title} subtitle={[t.manual.subtitle]} />
        <a
          href={switchHref}
          hrefLang={other}
          lang={other}
          className="mt-5 rounded border border-[#d0d5da] px-2.5 py-1 text-sm text-brand-ink hover:border-brand"
        >
          {t.switchTo}
        </a>
      </div>
      <p className="mb-6 max-w-2xl">{t.manual.intro}</p>
      <ManualCheckForm lang={lang} />
    </div>
  );
}
