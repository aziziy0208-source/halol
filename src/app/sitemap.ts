import type { MetadataRoute } from "next";
import { SITE_PAGES, type SitePage } from "@/i18n/site";
import { siteUrl } from "@/lib/env";

// Only indexable pages, each language with its alternate. Datenschutz/privacy join
// once WHU supplies the real text.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: { page: SitePage; changeFrequency: "monthly" | "yearly"; priority: number }[] = [
    { page: "home", changeFrequency: "monthly", priority: 1 },
    { page: "check", changeFrequency: "yearly", priority: 0.6 },
    { page: "impressum", changeFrequency: "yearly", priority: 0.3 },
  ];
  const url = (path: string) => `${base}${path === "/" ? "/" : path}`;
  return pages.flatMap(({ page, changeFrequency, priority }) =>
    (["de", "en"] as const).map((lang) => ({
      url: url(SITE_PAGES[page][lang]),
      changeFrequency,
      priority: lang === "de" ? priority : Math.round(priority * 90) / 100,
      alternates: { languages: { de: url(SITE_PAGES[page].de), en: url(SITE_PAGES[page].en) } },
    })),
  );
}
