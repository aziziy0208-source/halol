import type { Metadata } from "next";
import { HomePage } from "@/components/site/home-page";
import { languageAlternates } from "@/i18n/site";

export const metadata: Metadata = {
  alternates: { canonical: "/", languages: languageAlternates("home") },
};

export default function GermanHomePage() {
  return <HomePage lang="de" />;
}
