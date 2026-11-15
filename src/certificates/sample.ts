import type { CertificateDocument } from "./document";

/**
 * Sample documents for reviewing the template without real data:
 *  - "short": a typical certificate that fits on one page
 *  - "long":  a very long company name, special characters and 60 products → annex pages
 *  - "draft": an unissued draft (watermark, no QR code yet)
 */
export type SampleVariant = "short" | "long" | "draft";

const PRODUCT_NAMES = [
  "Geflügel-Wiener",
  "Rinderhackfleisch, tiefgekühlt",
  "Hähnchenbrust-Aufschnitt",
  "Kalbsleberwurst fein",
  "Lammsalami luftgetrocknet",
  "Sucuk nach türkischer Art (scharf)",
  "Pastırma, dünn geschnitten",
  "Gelatinefreie Fruchtgummis",
  "Schokoladenkekse mit Haselnüssen",
  "Würzmischung „Döner“ für Großverbraucher",
];

function products(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `${PRODUCT_NAMES[i % PRODUCT_NAMES.length]}${i >= PRODUCT_NAMES.length ? ` – Variante ${Math.floor(i / PRODUCT_NAMES.length) + 1}` : ""}`,
    brand: i % 3 === 0 ? "Muster Halal" : i % 3 === 1 ? "Öztürk Gıda" : "Bäckerei Groß",
    articleNo: `MH-${String(1000 + i).padStart(5, "0")}`,
    description: i % 7 === 0 ? "Verpackungseinheiten 200 g, 500 g und 1 kg; Großhandelsgebinde 5 kg" : null,
  }));
}

export function sampleDocument(variant: SampleVariant, verification: CertificateDocument["verification"]): CertificateDocument {
  const long = variant === "long";
  return {
    certificateNumber: variant === "draft" ? null : "WHU-2026-00042",
    revision: long ? 2 : 0,
    isDraft: variant === "draft",
    watermark: variant === "draft" ? "draft" : "sample",
    company: {
      name: long
        ? "Großschlachterei & Feinkost Müller-Öztürk Lebensmittelproduktions- und Handelsgesellschaft mbH & Co. KG"
        : "Musterfirma Halal Foods GmbH",
      legalForm: long ? "GmbH & Co. KG" : "GmbH",
      address: long ? "Industriestraße 112–118, Halle 4" : "Musterstraße 12",
      postalCode: long ? "45127" : "80331",
      city: long ? "Essen" : "München",
      country: "DE",
    },
    productionSite: long ? "Fabrika: Organize Sanayi Bölgesi 3. Cadde No. 14, 34555 Çatalca / İstanbul, Türkiye" : null,
    scope: long
      ? "Schlachtung, Zerlegung, Herstellung und Verpackung von Fleisch- und Wurstwaren aus Rind, Lamm und Geflügel sowie Lagerung und Vertrieb"
      : "Herstellung und Verpackung von Geflügelwurstwaren",
    category: "Lebensmittel – tierischen Ursprungs",
    standards: long
      ? [
          { code: "OIC/SMIIC 1:2019", title: "General Requirements for Halal Food" },
          { code: "MS 1500:2019", title: "Halal Food – General Requirements (Malaysia, JAKIM)" },
        ]
      : [{ code: "OIC/SMIIC 1:2019", title: "General Requirements for Halal Food" }],
    products: products(long ? 60 : 3),
    issueDate: "2026-03-02",
    validUntil: "2027-03-01",
    auditDate: "2026-02-20",
    signatory: { name: "Max Mustermann", title: "Leiter der Zertifizierungsstelle · Head of Certification Body" },
    images: { signature: null, stamp: null, companyLogo: null },
    verification: variant === "draft" ? null : verification,
  };
}
