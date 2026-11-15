/**
 * Public site languages. German lives at the root (/, /impressum …), English under /en.
 * Page texts come from content/{de,en}/*.json; this file holds the UI strings that are
 * part of components (menus, ARIA labels, form feedback) and the URL mapping.
 */
export type SiteLang = "de" | "en";
export const SITE_LANGS: readonly SiteLang[] = ["de", "en"];

export const SITE_PAGES = {
  home: { de: "/", en: "/en" },
  impressum: { de: "/impressum", en: "/en/imprint" },
  datenschutz: { de: "/datenschutz", en: "/en/privacy" },
  check: { de: "/zertifikat-pruefen", en: "/en/verify-certificate" },
} as const;
export type SitePage = keyof typeof SITE_PAGES;

export function sitePath(page: SitePage, lang: SiteLang): string {
  return SITE_PAGES[page][lang];
}

/** hreflang alternates for page metadata. */
export function languageAlternates(page: SitePage) {
  return { de: SITE_PAGES[page].de, en: SITE_PAGES[page].en, "x-default": SITE_PAGES[page].de };
}

/**
 * Maps an internal German link ("/", "/#contact", "/impressum") to its English page.
 * External links, mail/phone links and same-page anchors stay unchanged.
 */
export function localizeHref(href: string, lang: SiteLang): string {
  if (lang === "de" || !href.startsWith("/")) return href;
  const [path, hash] = href.split("#") as [string, string | undefined];
  const page = (Object.keys(SITE_PAGES) as SitePage[]).find((p) => SITE_PAGES[p].de === path);
  if (!page) return href;
  return `${SITE_PAGES[page].en}${hash !== undefined ? `#${hash}` : ""}`;
}

const UI = {
  de: {
    toHome: "WHU – World Halal Union, zur Startseite",
    mainNav: "Hauptnavigation",
    openMenu: "Menü öffnen",
    closeMenu: "Menü schließen",
    languageNav: "Sprache",
    welcome: "Willkommen",
    h1: "Halal Zertifizierung – WHU World Halal Union",
    carousel: "Karussell",
    sliderLabel: "Standards und Mitgliedschaften",
    slide: "Folie",
    slideOf: (i: number, n: number) => `${i} von ${n}`,
    previousSlide: "Vorherige Folie",
    nextSlide: "Nächste Folie",
    imageBand: "Bildband",
    sending: "Wird gesendet …",
    privacyNote: "Ihre Angaben verwenden wir ausschließlich zur Bearbeitung Ihrer Anfrage. Weitere Informationen finden Sie in unserer",
    privacyLink: "Datenschutzerklärung",
    ogLocale: "de_DE",
  },
  en: {
    toHome: "WHU – World Halal Union, to the home page",
    mainNav: "Main navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    languageNav: "Language",
    welcome: "Welcome",
    h1: "Halal certification – WHU World Halal Union",
    carousel: "Carousel",
    sliderLabel: "Standards and memberships",
    slide: "Slide",
    slideOf: (i: number, n: number) => `${i} of ${n}`,
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    imageBand: "Image band",
    sending: "Sending …",
    privacyNote: "We use your details only to process your enquiry. More information is available in our",
    privacyLink: "privacy policy",
    ogLocale: "en_GB",
  },
} as const;

export type SiteUi = (typeof UI)[SiteLang];

export function siteUi(lang: SiteLang): SiteUi {
  return UI[lang];
}

export const LANGUAGE_NAMES: Record<SiteLang, { short: string; long: string }> = {
  de: { short: "DE", long: "Deutsch" },
  en: { short: "EN", long: "English" },
};
