import { z } from "zod";

/**
 * Editor payload for a certificate draft (shared by the client editor and the
 * server actions). Drafts may be incomplete; `issueProblems` lists what is still
 * missing before a certificate can be issued.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null))
  .transform((v) => v ?? null);

export const companyFieldsSchema = z.object({
  name: z.string().trim().min(2).max(300),
  legalForm: optionalText(60),
  address: z.string().trim().min(2).max(300),
  postalCode: optionalText(20),
  city: optionalText(120),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  registrationNo: optionalText(80),
  contactPerson: optionalText(120),
  email: z
    .string()
    .trim()
    .max(254)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)
    .pipe(z.email().nullable()),
  phone: optionalText(60),
});
export type CompanyFields = z.infer<typeof companyFieldsSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(1).max(300),
  brand: optionalText(120),
  articleNo: optionalText(80),
  description: optionalText(500),
});
export type ProductInput = z.infer<typeof productSchema>;

export const MAX_PRODUCTS = 2000;

export const draftSchema = z.object({
  id: z.string().min(1).nullable().optional(),
  company: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), companyId: z.string().min(1) }),
    z.object({ mode: z.literal("new"), fields: companyFieldsSchema }),
  ]),
  productionSite: optionalText(500),
  scope: z.string().trim().max(1000).default(""),
  category: optionalText(200),
  standardIds: z.array(z.string().min(1)).max(20).default([]),
  products: z.array(productSchema).max(MAX_PRODUCTS).default([]),
  issueDate: isoDate,
  validUntil: isoDate,
  auditDate: isoDate,
  signatoryId: z.string().min(1).nullable().optional().transform((v) => v ?? null),
  notes: optionalText(2000),
});
export type DraftInput = z.input<typeof draftSchema>;
export type DraftData = z.output<typeof draftSchema>;

/** Why a draft cannot be issued yet; texts in the admin dictionary (`problems`). */
export type IssueProblem = "scope" | "standards" | "issueDate" | "validUntil" | "dateOrder" | "signatory" | "signatoryInactive";

/** Reasons why a draft cannot be issued yet (empty = ready). */
export function issueProblems(d: {
  scope: string;
  standardIds: string[];
  issueDate: string | null;
  validUntil: string | null;
  signatoryId: string | null;
}): IssueProblem[] {
  const problems: IssueProblem[] = [];
  if (!d.scope.trim()) problems.push("scope");
  if (d.standardIds.length === 0) problems.push("standards");
  if (!d.issueDate) problems.push("issueDate");
  if (!d.validUntil) problems.push("validUntil");
  if (d.issueDate && d.validUntil && d.validUntil <= d.issueDate) problems.push("dateOrder");
  if (!d.signatoryId) problems.push("signatory");
  return problems;
}
