/**
 * Texts of the public verification pages (/v/{token} and the manual check),
 * German and English (spec §0, §8.2). Plain module: used by server and client code.
 */

export const VERIFY_LANGS = ["de", "en"] as const;
export type VerifyLang = (typeof VERIFY_LANGS)[number];

const de = {
  pageTitle: "Zertifikatsprüfung",
  bodyName: "WHU – World Halal Union · Zertifizierungsstelle",
  switchTo: "English",
  checking: "Zertifikat wird geprüft …",
  status: {
    VALID: { label: "GÜLTIG", text: (until: string) => `Dieses Halal-Zertifikat ist gültig bis ${until}.` },
    EXPIRED: { label: "ABGELAUFEN", text: (until: string) => `Die Gültigkeit dieses Zertifikats ist am ${until} abgelaufen.` },
    SUSPENDED: {
      label: "AUSGESETZT",
      text: (since: string) => `Dieses Zertifikat ist seit ${since} ausgesetzt und derzeit nicht gültig.`,
    },
    REVOKED: {
      label: "WIDERRUFEN",
      text: (since: string) => `Dieses Zertifikat wurde am ${since} widerrufen und ist nicht mehr gültig.`,
    },
    SUPERSEDED: { label: "ERSETZT", text: () => "Dieses Zertifikat wurde durch eine neuere Fassung ersetzt und ist nicht mehr maßgeblich." },
  },
  showCurrent: (revision: number) => `Aktuelle Fassung anzeigen${revision > 0 ? ` (Rev. ${revision})` : ""}`,
  certificateNo: "Zertifikat-Nr.",
  revision: "Revision",
  holder: "Zertifikatsinhaber",
  productionSite: "Produktionsstätte",
  scope: "Geltungsbereich",
  category: "Kategorie",
  standards: "Norm(en)",
  issueDate: "Ausgestellt am",
  validUntil: "Gültig bis",
  body: "Zertifizierungsstelle",
  products: (n: number) => `Zertifizierte Produkte (${n})`,
  brand: "Marke",
  articleNo: "Art.-Nr.",
  showAllProducts: (n: number) => `Alle ${n} Produkte anzeigen`,
  document: "Zertifikat",
  downloadPdf: "PDF herunterladen",
  previewAlt: (number: string) => `Vorschau des Zertifikats ${number}`,
  noDocument: "Das Zertifikatsdokument ist nur für gültige Zertifikate abrufbar.",
  legacy:
    "Dieses Zertifikat wurde vor Einführung der Online-Prüfung ausgestellt. Maßgeblich ist das Originaldokument; die Angaben oben stammen aus dem Zertifikatsregister der WHU.",
  warningTitle: "Wichtig",
  warning:
    "Maßgeblich sind ausschließlich die Angaben auf dieser Seite. Stimmt das Dokument, das Ihnen vorliegt, nicht mit diesen Angaben überein, kontaktieren Sie uns bitte:",
  checkedAt: (when: string) => `Geprüft am ${when}`,
  notFound: {
    label: "NICHT GEFUNDEN",
    title: "Zertifikat nicht gefunden",
    text: "Zu diesem Link bzw. dieser Nummer gibt es kein gültiges Zertifikat in unserem Register.",
    warning:
      "Das Dokument könnte gefälscht oder fehlerhaft sein. Bitte verlassen Sie sich nicht darauf und kontaktieren Sie uns:",
  },
  rateLimited: {
    title: "Zu viele Anfragen",
    text: "Bitte warten Sie einen Moment und laden Sie die Seite dann erneut.",
  },
  manual: {
    title: "Zertifikat prüfen",
    subtitle: "Echtheit eines WHU-Zertifikats prüfen",
    intro:
      "Scannen Sie den QR-Code auf dem Zertifikat oder der Verpackung – oder geben Sie hier die Zertifikatsnummer ein. Sie sehen dann den aktuellen Status direkt aus unserem Register.",
    number: "Zertifikatsnummer",
    placeholder: "z. B. H-202026.0021-1",
    submit: "Prüfen",
    checking: "Wird geprüft …",
    humanHint: "Kurze automatische Sicherheitsprüfung (ohne Cookies, ohne Bilderrätsel).",
    invalidNumber: "Bitte geben Sie eine Zertifikatsnummer ein.",
    captcha: "Die Sicherheitsprüfung ist fehlgeschlagen oder abgelaufen. Bitte erneut versuchen.",
    rateLimited: "Zu viele Prüfungen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten erneut.",
    notFound: (number: string) => `Zur Nummer „${number}“ wurde kein Zertifikat gefunden.`,
  },
  dateLocale: "de-DE",
};

export type VerifyTexts = typeof de;

const en: VerifyTexts = {
  pageTitle: "Certificate verification",
  bodyName: "WHU – World Halal Union · Certification Body",
  switchTo: "Deutsch",
  checking: "Checking certificate …",
  status: {
    VALID: { label: "VALID", text: (until: string) => `This halal certificate is valid until ${until}.` },
    EXPIRED: { label: "EXPIRED", text: (until: string) => `This certificate expired on ${until}.` },
    SUSPENDED: { label: "SUSPENDED", text: (since: string) => `This certificate has been suspended since ${since} and is currently not valid.` },
    REVOKED: { label: "REVOKED", text: (since: string) => `This certificate was revoked on ${since} and is no longer valid.` },
    SUPERSEDED: { label: "SUPERSEDED", text: () => "This certificate has been replaced by a newer version and is no longer authoritative." },
  },
  showCurrent: (revision: number) => `Show the current version${revision > 0 ? ` (Rev. ${revision})` : ""}`,
  certificateNo: "Certificate no.",
  revision: "Revision",
  holder: "Certificate holder",
  productionSite: "Production site",
  scope: "Scope",
  category: "Category",
  standards: "Standard(s)",
  issueDate: "Date of issue",
  validUntil: "Valid until",
  body: "Certification body",
  products: (n: number) => `Certified products (${n})`,
  brand: "Brand",
  articleNo: "Item no.",
  showAllProducts: (n: number) => `Show all ${n} products`,
  document: "Certificate",
  downloadPdf: "Download PDF",
  previewAlt: (number: string) => `Preview of certificate ${number}`,
  noDocument: "The certificate document is only available for valid certificates.",
  legacy:
    "This certificate was issued before online verification was introduced. The original document applies; the details above come from WHU's certificate register.",
  warningTitle: "Important",
  warning:
    "Only the information on this page is authoritative. If the document you have does not match it, please contact us:",
  checkedAt: (when: string) => `Checked on ${when}`,
  notFound: {
    label: "NOT FOUND",
    title: "Certificate not found",
    text: "There is no valid certificate in our register for this link or number.",
    warning: "The document may be forged or incorrect. Please do not rely on it and contact us:",
  },
  rateLimited: {
    title: "Too many requests",
    text: "Please wait a moment and then reload the page.",
  },
  manual: {
    title: "Verify a certificate",
    subtitle: "Check the authenticity of a WHU certificate",
    intro:
      "Scan the QR code on the certificate or the packaging — or enter the certificate number here. You will see the current status straight from our register.",
    number: "Certificate number",
    placeholder: "e.g. H-202026.0021-1",
    submit: "Verify",
    checking: "Checking …",
    humanHint: "Short automatic security check (no cookies, no picture puzzles).",
    invalidNumber: "Please enter a certificate number.",
    captcha: "The security check failed or expired. Please try again.",
    rateLimited: "Too many checks in a short time. Please try again in a few minutes.",
    notFound: (number: string) => `No certificate found for number “${number}”.`,
  },
  dateLocale: "en-GB",
};

const TEXTS: Record<VerifyLang, VerifyTexts> = { de, en };

export function verifyTexts(lang: VerifyLang): VerifyTexts {
  return TEXTS[lang];
}

export function isVerifyLang(value: unknown): value is VerifyLang {
  return value === "de" || value === "en";
}

/**
 * Explicit ?lang= wins; otherwise the browser's preferred language among DE/EN
 * (Accept-Language, by q-value). Visitors whose browser prefers neither get English.
 */
export function pickVerifyLang(param: string | undefined, acceptLanguage: string | null): VerifyLang {
  if (isVerifyLang(param)) return param;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? "1");
      return { tag, q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    if (tag === "de" || tag.startsWith("de-")) return "de";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "en";
}

/** 15.11.2026 / 15 Nov 2026 */
export function formatVerifyDate(iso: string, lang: VerifyLang): string {
  return new Intl.DateTimeFormat(TEXTS[lang].dateLocale, {
    timeZone: "UTC",
    day: "2-digit",
    month: lang === "de" ? "2-digit" : "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** 15.11.2026, 14:05 MEZ / 15 Nov 2026, 14:05 CET — the moment of the check, Berlin time. */
export function formatVerifyDateTime(date: Date, lang: VerifyLang): string {
  return new Intl.DateTimeFormat(TEXTS[lang].dateLocale, {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: lang === "de" ? "2-digit" : "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function countryName(code: string, lang: VerifyLang): string {
  try {
    return new Intl.DisplayNames([TEXTS[lang].dateLocale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
