import type { CompanyFieldValues } from "@/components/admin/company-values";
import type { CertificateDocument } from "@/certificates/document";

/** Client-safe types shared by the editor page (server) and the editor (client). */

export type ProductRow = { key: string; name: string; brand: string; articleNo: string; description: string };

export type EditorState = {
  companyMode: "existing" | "new";
  companyId: string;
  newCompany: CompanyFieldValues;
  productionSite: string;
  scope: string;
  category: string;
  standardIds: string[];
  products: ProductRow[];
  issueDate: string;
  validUntil: string;
  /** false while “valid until” still follows the issue date automatically. */
  validUntilTouched: boolean;
  auditDate: string;
  signatoryId: string;
  notes: string;
};

export type EditorCompany = {
  id: string;
  name: string;
  legalForm: string | null;
  address: string;
  postalCode: string | null;
  city: string | null;
  country: string;
};

export type EditorSignatory = { id: string; name: string; title: string; signature: string | null; stamp: string | null };

export type EditorData = {
  draftId: string | null;
  status: "DRAFT" | "PENDING_APPROVAL" | null;
  certificateNumber: string | null;
  revision: number;
  templateVersion: number;
  initial: EditorState;
  companies: EditorCompany[];
  standards: { id: string; code: string; title: string }[];
  signatories: EditorSignatory[];
  verification: CertificateDocument["verification"];
  defaultValidityMonths: number;
  canCreateCompany: boolean;
  /** certificate.issue permission. */
  canIssue: boolean;
  fourEyes: boolean;
  /** True if the current user created this draft (or is creating it). */
  isCreator: boolean;
};

export type EditorIntent = "save" | "submit" | "issue";

export type EditorResult =
  | { ok: true; id: string; message: string; redirectTo?: string; saved?: SavedDraft }
  | { ok: false; message: string; issues?: string[]; id?: string; saved?: SavedDraft };

/** State of the saved draft the editor continues with (company now exists, QR known). */
export type SavedDraft = { companyId: string; verification: CertificateDocument["verification"] };
