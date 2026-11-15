import type { Metadata } from "next";
import { contentFor } from "@/content";
import { SimplePage } from "@/components/site/simple-page";
import { languageAlternates } from "@/i18n/site";

// Placeholder until WHU provides the privacy policy — keep out of search results meanwhile.
export const metadata: Metadata = {
  title: "Privacy policy",
  robots: { index: false, follow: true },
  alternates: { languages: languageAlternates("datenschutz") },
};

export default function PrivacyPage() {
  return <SimplePage page={contentFor("en").pages.datenschutz} lang="en" pageKey="datenschutz" />;
}
