import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { TitleBar } from "@/components/site/layout-primitives";
import { PageFrame } from "@/components/site/simple-page";
import { pickVerifyLang, verifyTexts } from "@/i18n/verify";
import { ManualCheckForm } from "./manual-check-form";

export const metadata: Metadata = {
  title: "Zertifikat prüfen",
  description: "Echtheit und Status eines WHU-Halal-Zertifikats prüfen – per QR-Code oder Zertifikatsnummer.",
  alternates: { canonical: "/zertifikat-pruefen" },
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function ZertifikatPruefenPage(props: PageProps<"/zertifikat-pruefen">) {
  return (
    <PageFrame>
      <Suspense fallback={<TitleBar title="Zertifikat prüfen" subtitle={[]} />}>
        <ManualCheck {...props} />
      </Suspense>
    </PageFrame>
  );
}

/** DE/EN like the result page: ?lang= or the browser's language (spec §0, §8.3). */
async function ManualCheck({ searchParams }: PageProps<"/zertifikat-pruefen">) {
  const [sp, h] = await Promise.all([searchParams, headers()]);
  const lang = pickVerifyLang(first(sp.lang), h.get("accept-language"));
  const t = verifyTexts(lang);
  const other = lang === "de" ? "en" : "de";
  return (
    <div lang={lang}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TitleBar title={t.manual.title} subtitle={[t.manual.subtitle]} />
        <a
          href={`/zertifikat-pruefen?lang=${other}`}
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
