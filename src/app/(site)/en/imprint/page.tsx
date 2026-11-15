import type { Metadata } from "next";
import { ImpressumView } from "@/components/site/impressum-view";
import { languageAlternates } from "@/i18n/site";

export const metadata: Metadata = {
  title: "Legal notice",
  alternates: { canonical: "/en/imprint", languages: languageAlternates("impressum") },
  openGraph: { locale: "en_GB" },
};

export default function ImprintPage() {
  return <ImpressumView lang="en" />;
}
