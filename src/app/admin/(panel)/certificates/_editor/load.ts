import "server-only";
import { type CompanyFieldValues, EMPTY_COMPANY } from "@/components/admin/company-values";
import { imageDataUri, type LoadedCertificate, verificationFor } from "@/certificates/load";
import { CURRENT_TEMPLATE_VERSION } from "@/certificates/templates";
import type { AdminUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/certificates/snapshot";
import { businessToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { addMonths, getSettings } from "@/lib/settings";
import type { EditorData, EditorState } from "./types";

let keySeq = 0;
export const productKey = () => `p${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** Everything the editor needs, for a new draft (cert = null) or an existing one. */
export async function loadEditorData(user: AdminUser, cert: LoadedCertificate | null, presetCompanyId?: string): Promise<EditorData> {
  const settings = await getSettings();
  const selectedStandardIds = cert?.standards.map((s) => s.standardId) ?? [];
  const [companies, standards, signatories] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalForm: true, address: true, postalCode: true, city: true, country: true },
    }),
    prisma.standard.findMany({
      where: { OR: [{ isActive: true }, { id: { in: selectedStandardIds } }] },
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true },
    }),
    prisma.signatory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const today = toIsoDate(businessToday());
  const iso = (d: Date | null) => (d ? toIsoDate(d) : "");
  const preset = presetCompanyId && companies.some((c) => c.id === presetCompanyId) ? presetCompanyId : "";
  const initial: EditorState = cert
    ? {
        companyMode: "existing",
        companyId: cert.companyId,
        newCompany: { ...EMPTY_COMPANY } satisfies CompanyFieldValues,
        productionSite: cert.productionSite ?? "",
        scope: cert.scope,
        category: cert.category ?? "",
        standardIds: selectedStandardIds,
        products: cert.products.map((p) => ({
          key: productKey(),
          name: p.name,
          brand: p.brand ?? "",
          articleNo: p.articleNo ?? "",
          description: p.description ?? "",
        })),
        issueDate: iso(cert.issueDate),
        validUntil: iso(cert.validUntil),
        validUntilTouched: true,
        auditDate: iso(cert.auditDate),
        signatoryId: cert.signatory?.isActive ? (cert.signatoryId ?? "") : "",
        notes: cert.notes ?? "",
      }
    : {
        companyMode: companies.length === 0 && can(user.role, "company.create") ? "new" : "existing",
        companyId: preset,
        newCompany: { ...EMPTY_COMPANY },
        productionSite: "",
        scope: "",
        category: "",
        standardIds: [],
        products: [],
        issueDate: today,
        validUntil: addMonths(today, settings.defaultValidityMonths),
        validUntilTouched: false,
        auditDate: "",
        signatoryId: signatories.length === 1 ? signatories[0]!.id : "",
        notes: "",
      };

  return {
    draftId: cert?.id ?? null,
    status: cert ? (cert.status as "DRAFT" | "PENDING_APPROVAL") : null,
    certificateNumber: cert?.certificateNumber ?? null,
    revision: cert?.revision ?? 0,
    templateVersion: CURRENT_TEMPLATE_VERSION,
    initial,
    companies,
    standards,
    signatories: await Promise.all(
      signatories.map(async (s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        signature: await imageDataUri(s.signatureImageKey),
        stamp: await imageDataUri(s.stampImageKey),
      })),
    ),
    verification: await verificationFor(cert?.publicToken ?? null),
    defaultValidityMonths: settings.defaultValidityMonths,
    canCreateCompany: can(user.role, "company.create"),
    canIssue: can(user.role, "certificate.issue"),
    fourEyes: settings.fourEyes,
    isCreator: cert ? cert.createdById === user.id : true,
  };
}
