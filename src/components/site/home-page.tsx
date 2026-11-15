import { contentFor } from "@/content";
import { type SiteLang, SITE_PAGES, siteUi } from "@/i18n/site";
import { siteUrl } from "@/lib/env";
import { ContactSection } from "./contact-section";
import { ContentSection } from "./content-section";
import { Footer } from "./footer";
import { Header } from "./header";
import { Hero } from "./hero";
import { HtmlLang } from "./html-lang";
import { Parallax } from "./parallax";
import { Slider } from "./slider";
import { SurenSection } from "./suren-section";
import { WeblinksSection } from "./weblinks-section";

/** The one-page site, in the section order of the original halal-zertifizierung.de. */
export function HomePage({ lang }: { lang: SiteLang }) {
  const c = contentFor(lang);
  const t = siteUi(lang);
  const base = siteUrl();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: c.site.meta.siteName,
    alternateName: "Welt Halal Union",
    url: `${base}${lang === "de" ? "" : SITE_PAGES.home.en}`,
    logo: `${base}/assets/brand/whu-logo-large.png`,
    email: c.site.footer.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: c.site.footer.address[0],
      addressLocality: "München",
      addressCountry: "DE",
    },
  };

  return (
    <div lang={lang} className="flex flex-1 flex-col">
      {lang !== "de" ? <HtmlLang lang={lang} /> : null}
      <Hero slides={c.site.hero} lang={lang} />
      <Header nav={c.site.nav} variant="home" lang={lang} alternates={SITE_PAGES.home} />
      <main className="flex-1">
        <h1 className="sr-only">{t.h1}</h1>
        <ContentSection section={c.about} before={<Slider slides={c.site.slider} lang={lang} />} lang={lang} />
        <ContentSection section={c.services} lang={lang} />
        <ContentSection section={c.vorteile} lang={lang} />
        <ContentSection section={c.halal} lang={lang} />
        <SurenSection section={c.suren} />
        <ContentSection section={c.markt} lang={lang} />
        <ContactSection section={c.contact} lang={lang} />
        <WeblinksSection section={c.weblinks} />
        <Parallax image={c.site.closingParallax.image} lang={lang} />
      </main>
      <Footer lang={lang} />
      <script
        type="application/ld+json"
        // Static JSON from our own content files; no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </div>
  );
}
