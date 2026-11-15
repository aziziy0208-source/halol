import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { TitleBar } from "@/components/site/layout-primitives";
import { PageFrame } from "@/components/site/simple-page";
import { languageAlternates } from "@/i18n/site";
import { pickVerifyLang } from "@/i18n/verify";
import { ManualCheckView } from "./check-view";

export const metadata: Metadata = {
  title: "Zertifikat prüfen",
  description: "Echtheit und Status eines WHU-Halal-Zertifikats prüfen – per QR-Code oder Zertifikatsnummer.",
  alternates: { canonical: "/zertifikat-pruefen", languages: languageAlternates("check") },
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function ZertifikatPruefenPage(props: PageProps<"/zertifikat-pruefen">) {
  return (
    <PageFrame lang="de" page="check">
      <Suspense fallback={<TitleBar title="Zertifikat prüfen" subtitle={[]} />}>
        <ManualCheck {...props} />
      </Suspense>
    </PageFrame>
  );
}

/** DE/EN like the result page: ?lang= or the browser's language (spec §0, §8.3). */
async function ManualCheck({ searchParams }: PageProps<"/zertifikat-pruefen">) {
  const [sp, h] = await Promise.all([searchParams, headers()]);
  return <ManualCheckView lang={pickVerifyLang(first(sp.lang), h.get("accept-language"))} />;
}
