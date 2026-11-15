/**
 * Fixed wording of certificate template v1 (German / English).
 * The wording is part of the template version: changing it later means a new
 * template version, so certificates already issued keep the text they were issued with.
 *
 * PROVISIONAL — to be confirmed by WHU (legal wording, address, signatory block).
 */
export const TEXTS_V1 = {
  orgName: "WORLD HALAL UNION",
  orgNameDe: "Welt Halal Union",
  body: "Zertifizierungsstelle · Certification Body",
  title: "HALAL-ZERTIFIKAT",
  titleEn: "HALAL CERTIFICATE",
  titleAr: "شهادة حلال",
  number: ["Zertifikat-Nr.", "Certificate No."],
  draftNumber: "— (Entwurf · draft)",
  certify: ["Hiermit wird bestätigt, dass", "This is to certify that"],
  complies: [
    "die Anforderungen der folgenden Halal-Norm(en) erfüllt",
    "complies with the requirements of the following halal standard(s)",
  ],
  productionSite: ["Produktionsstätte", "Production site"],
  scope: ["Geltungsbereich", "Scope"],
  category: ["Kategorie", "Category"],
  products: ["Zertifizierte Produkte", "Certified products"],
  colProduct: ["Produkt", "Product"],
  colBrand: ["Marke", "Brand"],
  colArticle: ["Art.-Nr.", "Item no."],
  productsInAnnex: (count: number) => [
    `Die ${count} zertifizierten Produkte sind in der Anlage zu diesem Zertifikat aufgeführt.`,
    `The ${count} certified products are listed in the annex to this certificate.`,
  ],
  noProducts: ["Keine Einzelprodukte aufgeführt.", "No individual products listed."],
  issueDate: ["Ausstellungsdatum", "Date of issue"],
  validUntil: ["Gültig bis", "Valid until"],
  auditDate: ["Auditdatum", "Audit date"],
  verify: ["Echtheit online prüfen", "Verify authenticity online"],
  qrPending: ["QR-Code wird bei der Ausstellung erzeugt", "QR code is generated on issue"],
  place: "München",
  signature: ["Unterschrift", "Signature"],
  validityNote:
    "Gültig nur in Verbindung mit der Online-Prüfung unter der angegebenen Adresse. Das Zertifikat bleibt Eigentum der WHU. · " +
    "Valid only together with the online verification at the address shown. The certificate remains the property of WHU.",
  // Open question to WHU: which office address belongs on the certificate.
  footer: "WHU – World Halal Union · Zertifizierungsstelle · Rupert-Mayer-Str. 44 · D-81379 München · info@halal-zertifizierung.com",
  annexTitle: ["Anlage zum Halal-Zertifikat", "Annex to halal certificate"],
  page: (current: number, total: number) => `Seite ${current} von ${total} · Page ${current} of ${total}`,
  draftMark: "ENTWURF · DRAFT",
  sampleMark: "MUSTER · SAMPLE",
} as const;
