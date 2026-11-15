import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// /v/ (verification pages) is NOT disallowed on purpose: crawlers must be able
// to fetch those pages to see their noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
