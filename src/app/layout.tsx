import type { Metadata, Viewport } from "next";
import { Noto_Naskh_Arabic, Open_Sans, Oswald } from "next/font/google";
import { content } from "@/content";
import { siteUrl } from "@/lib/env";
import "./globals.css";

// next/font downloads the files at build time and serves them from our own
// domain, so visitors' browsers never contact Google (DSGVO, LG München 2022).
// Variable fonts (no `weight`): one file per family covers all weights.
// Only the latin subset is preloaded; latin-ext (ḥ, ā, Turkish letters) still
// loads on demand through unicode-range when such characters appear.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

// Only the Qur'an section and a few words use Arabic script: don't preload.
const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-arabic-face",
  subsets: ["arabic"],
  weight: ["400"],
  preload: false,
});

const { meta } = content.site;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: meta.title, template: `%s | ${meta.siteName}` },
  description: meta.description,
  keywords: meta.keywords,
  applicationName: meta.siteName,
  // Canonical URLs are set per page (a root-level canonical would leak into every sub-page).
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: meta.siteName,
    title: meta.title,
    description: meta.description,
    url: "/",
    images: [{ url: "/assets/hero/hero-2.jpg", width: 2300, height: 1600, alt: meta.siteName }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0099cc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${openSans.variable} ${oswald.variable} ${notoNaskhArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
