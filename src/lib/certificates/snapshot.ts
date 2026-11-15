/**
 * Frozen certificate content, written to Certificate.snapshot on issue.
 * The PDF, the PNG preview and the public verification page all read from it,
 * so editing a company, standard or signatory later never alters an issued
 * certificate. Bump `v` if the shape changes; old snapshots keep their version.
 */
export type CertificateSnapshotV1 = {
  v: 1;
  certificateNumber: string;
  revision: number;
  company: {
    name: string;
    legalForm: string | null;
    address: string;
    postalCode: string | null;
    city: string | null;
    country: string;
  };
  productionSite: string | null;
  scope: string;
  category: string | null;
  standards: { code: string; title: string }[];
  products: {
    name: string;
    brand: string | null;
    articleNo: string | null;
    description: string | null;
  }[];
  issueDate: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  auditDate: string | null; // YYYY-MM-DD
  signatory: { name: string; title: string } | null;
  /**
   * Storage keys of the signature/stamp images as they were at issue time
   * (optional: older snapshots, e.g. imported legacy certificates, don't have them).
   */
  signatureImageKey?: string | null;
  stampImageKey?: string | null;
  /** The certificate holder's logo at issue time (template v2; optional). */
  companyLogoKey?: string | null;
};

export type CertificateSnapshot = CertificateSnapshotV1;

/** Formats a @db.Date value (UTC midnight) as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
