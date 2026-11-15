import type { Metadata } from "next";
import { contentFor } from "@/content";
import { HomePage } from "@/components/site/home-page";
import { languageAlternates } from "@/i18n/site";

const { meta } = contentFor("en").site;

export const metadata: Metadata = {
  title: { absolute: meta.title },
  description: meta.description,
  keywords: meta.keywords,
  alternates: { canonical: "/en", languages: languageAlternates("home") },
  openGraph: {
    type: "website",
    locale: "en_GB",
    alternateLocale: ["de_DE"],
    siteName: meta.siteName,
    title: meta.title,
    description: meta.description,
    url: "/en",
    images: [{ url: "/assets/hero/hero-2.jpg", width: 2300, height: 1600, alt: meta.siteName }],
  },
};

export default function EnglishHomePage() {
  return <HomePage lang="en" />;
}
