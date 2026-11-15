/**
 * Template v2 — WHU's official certificate (WHU_Certificate_EN_2026.docx).
 * English wording exactly as in the original; "ZERTIFIKAT / CERTIFICATE" is part
 * of the background artwork.
 */
export const TEXTS_V2 = {
  intro: "The Certification Body WHU – World Halal Union",
  confirms: "confirms that the company",
  meets: "meets the requirements of the",
  standardsSuffix: "Halal Standards",
  scopeIntro: "for the production of halal items for the scopes",
  statement: [
    "The Halal Certification Body WHU – World Halal Union hereby certifies that the products",
    "met the Halal requirements in according with the Islamic Law.",
    "The verification and certification have been undertaken in full compliance with",
  ],
  guidelines: (codes: string) => `guidelines ${codes} and respectively CAC/GL 24-1997.`,
  productionSite: "Production site:",
  productsList: "Products list:",
  productsInAnnex: (n: number) => `${n} products — see annex`,
  validity: { before: "This certification is only valid till", after: "and is subject to renewal at that time." },
  number: "Certificate Nr.",
  validFrom: "Certificate valid from:",
  validUntil: "Certificate valid until:",
  place: "Munich",
  issuer: ["WHU – World Halal Union", "Brudermuehlstr. 12", "D-81371 Munich, Germany"],
  annexTitle: "Annex – Products list",
  page: (i: number, n: number) => `Page ${i} of ${n}`,
  draftNumber: "— (assigned on issue)",
  draftMark: "ENTWURF · DRAFT",
  sampleMark: "MUSTER · SAMPLE",
  qrPending: "QR code is created on issue",
  verifyCaption: "Online verification",
  // Contact line in the blue footer band (the artwork's own line was removed from background.png).
  footerContact: ["info@halal-zertifizierung.org", "halal-zertifizierung.org"],
} as const;
