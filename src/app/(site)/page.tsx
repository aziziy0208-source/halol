import { content } from "@/content";
import { ContactSection } from "@/components/site/contact-section";
import { ContentSection } from "@/components/site/content-section";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { Parallax } from "@/components/site/parallax";
import { Slider } from "@/components/site/slider";
import { SurenSection } from "@/components/site/suren-section";
import { WeblinksSection } from "@/components/site/weblinks-section";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** The one-page site, in the section order of the original halal-zertifizierung.de. */
export default function HomePage() {
  const c = content;
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: c.site.meta.siteName,
    alternateName: "Welt Halal Union",
    url: siteUrl(),
    logo: `${siteUrl()}/assets/brand/whu-logo-large.png`,
    email: c.site.footer.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: c.site.footer.address[0],
      addressLocality: "München",
      addressCountry: "DE",
    },
  };

  return (
    <>
      <Hero slides={c.site.hero} />
      <Header nav={c.site.nav} variant="home" />
      <main className="flex-1">
        <h1 className="sr-only">Halal Zertifizierung – WHU World Halal Union</h1>
        <ContentSection section={c.about} before={<Slider slides={c.site.slider} />} />
        <ContentSection section={c.services} />
        <ContentSection section={c.vorteile} />
        <ContentSection section={c.halal} />
        <SurenSection section={c.suren} />
        <ContentSection section={c.markt} />
        <ContactSection section={c.contact} />
        <WeblinksSection section={c.weblinks} />
        <Parallax image={c.site.closingParallax.image} />
      </main>
      <script
        type="application/ld+json"
        // Static JSON from our own content files; no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  );
}
