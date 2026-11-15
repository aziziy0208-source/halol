import type { Metadata } from "next";
import { ImpressumView } from "@/components/site/impressum-view";
import { languageAlternates } from "@/i18n/site";

export const metadata: Metadata = {
  title: "Impressum",
  alternates: { canonical: "/impressum", languages: languageAlternates("impressum") },
};

export default function ImpressumPage() {
  return <ImpressumView lang="de" />;
}
