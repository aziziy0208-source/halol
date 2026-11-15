import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// Only indexable pages. Datenschutz joins once WHU supplies the real text.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/zertifikat-pruefen`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/impressum`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
