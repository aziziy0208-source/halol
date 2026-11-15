import "server-only";
import type { CertificateStatus, Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { parseCertificateNumber } from "@/lib/certificates/number";
import type { CertificateSnapshot } from "@/lib/certificates/snapshot";
import { headerKey, parseCsv, parseDate } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { generatePublicToken } from "@/lib/tokens";
import { CURRENT_TEMPLATE_VERSION } from "./templates";
import type { WorkflowContext } from "./workflow";

/**
 * Import of certificates WHU issued before this system (spec §7.3.6). They become
 * verifiable by number and QR token like new ones, flagged `isLegacy` (no PDF is
 * generated for them — the original paper certificate looked different).
 *
 * CSV columns (header names in German or English, any order, ";" or ","):
 *   certificateNumber*, revision, company*, address*, postalCode, city, country (ISO, default DE),
 *   scope*, category, standards* (codes, separated by "|"), products (names, "|"),
 *   issueDate*, validUntil* (YYYY-MM-DD or DD.MM.YYYY), auditDate, status (ACTIVE|SUSPENDED|REVOKED)
 */

export const MAX_IMPORT_ROWS = 5000;

const COLUMNS: Record<string, string[]> = {
  certificateNumber: ["certificatenumber", "number", "nummer", "zertifikatsnummer", "zertifikatnr", "certificateno", "nr"],
  revision: ["revision", "rev"],
  company: ["company", "companyname", "firma", "unternehmen"],
  address: ["address", "adresse", "strasse", "street", "anschrift"],
  postalCode: ["postalcode", "plz", "zip", "postleitzahl"],
  city: ["city", "ort", "stadt"],
  country: ["country", "land"],
  scope: ["scope", "geltungsbereich"],
  category: ["category", "kategorie"],
  standards: ["standards", "standard", "norm", "normen"],
  products: ["products", "produkte", "product", "produkt"],
  issueDate: ["issuedate", "ausstellungsdatum", "issued", "ausgestelltam"],
  validUntil: ["validuntil", "gultigbis", "gueltigbis", "ablaufdatum", "valid"],
  auditDate: ["auditdate", "auditdatum", "audit"],
  status: ["status"],
};

const STATUS_ALIASES: Record<string, CertificateStatus> = {
  "": "ACTIVE",
  active: "ACTIVE",
  aktiv: "ACTIVE",
  valid: "ACTIVE",
  gultig: "ACTIVE",
  suspended: "SUSPENDED",
  ausgesetzt: "SUSPENDED",
  revoked: "REVOKED",
  widerrufen: "REVOKED",
};

export type LegacyRow = {
  line: number;
  certificateNumber: string;
  revision: number;
  company: { name: string; address: string; postalCode: string | null; city: string | null; country: string };
  scope: string;
  category: string | null;
  standardIds: string[];
  standards: { code: string; title: string }[];
  products: string[];
  issueDate: string;
  validUntil: string;
  auditDate: string | null;
  status: CertificateStatus;
};

export type LegacyParseResult = { rows: LegacyRow[]; errors: { line: number; message: string }[]; missingColumns: string[] };

const REQUIRED = ["certificateNumber", "company", "address", "scope", "standards", "issueDate", "validUntil"];

export async function parseLegacyCsv(text: string): Promise<LegacyParseResult> {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: [{ line: 1, message: "The file has no data rows." }], missingColumns: [] };
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Too many rows (max. ${MAX_IMPORT_ROWS} per import).` }], missingColumns: [] };
  }

  const header = table[0]!.map(headerKey);
  const index: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) index[field] = i;
  }
  const missingColumns = REQUIRED.filter((f) => index[f] === undefined);
  if (missingColumns.length) return { rows: [], errors: [], missingColumns };

  const standards = await prisma.standard.findMany();
  const byCode = new Map(standards.map((s) => [s.code.toLowerCase(), s]));
  const numbers = table.slice(1).map((r) => (r[index.certificateNumber!] ?? "").trim());
  const existing = await prisma.certificate.findMany({
    where: { certificateNumber: { in: numbers.filter(Boolean) } },
    select: { certificateNumber: true, revision: true },
  });
  const taken = new Set(existing.map((e) => `${e.certificateNumber}#${e.revision}`));
  const seen = new Set<string>();

  const rows: LegacyRow[] = [];
  const errors: { line: number; message: string }[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (field: string) => (index[field] === undefined ? "" : (cells[index[field]!] ?? "").trim());
    const problems: string[] = [];

    const certificateNumber = get("certificateNumber");
    if (!certificateNumber || certificateNumber.length > 60) problems.push("certificate number missing or too long");
    const revision = get("revision") ? Number(get("revision")) : 0;
    if (!Number.isInteger(revision) || revision < 0 || revision > 99) problems.push("revision must be 0–99");
    const key = `${certificateNumber}#${revision}`;
    if (taken.has(key)) problems.push(`${certificateNumber} (Rev. ${revision}) already exists in the system`);
    if (seen.has(key)) problems.push(`${certificateNumber} (Rev. ${revision}) appears twice in the file`);
    seen.add(key);

    const name = get("company");
    const address = get("address");
    if (name.length < 2) problems.push("company name missing");
    if (address.length < 2) problems.push("address missing");
    const country = (get("country") || "DE").toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) problems.push(`country "${country}" is not a 2-letter ISO code`);

    const scope = get("scope");
    if (!scope) problems.push("scope missing");

    const codes = get("standards").split("|").map((c) => c.trim()).filter(Boolean);
    const matched = codes.map((c) => byCode.get(c.toLowerCase()));
    if (codes.length === 0) problems.push("no standard given");
    const unknown = codes.filter((_, j) => !matched[j]);
    if (unknown.length) problems.push(`unknown standard(s): ${unknown.join(", ")} — add them in Settings first`);

    const issueDate = parseDate(get("issueDate"));
    const validUntil = parseDate(get("validUntil"));
    const auditRaw = get("auditDate");
    const auditDate = auditRaw ? parseDate(auditRaw) : null;
    if (!issueDate) problems.push(`invalid issue date "${get("issueDate")}"`);
    if (!validUntil) problems.push(`invalid valid-until date "${get("validUntil")}"`);
    if (auditRaw && !auditDate) problems.push(`invalid audit date "${auditRaw}"`);
    if (issueDate && validUntil && validUntil <= issueDate) problems.push("valid-until must be after the issue date");

    const status = STATUS_ALIASES[headerKey(get("status"))];
    if (!status) problems.push(`unknown status "${get("status")}" (use ACTIVE, SUSPENDED or REVOKED)`);

    if (problems.length) {
      errors.push({ line, message: problems.join("; ") });
      return;
    }
    rows.push({
      line,
      certificateNumber,
      revision,
      company: { name, address, postalCode: get("postalCode") || null, city: get("city") || null, country },
      scope,
      category: get("category") || null,
      standardIds: matched.map((s) => s!.id),
      standards: matched.map((s) => ({ code: s!.code, title: s!.title })),
      products: get("products").split("|").map((p) => p.trim()).filter(Boolean),
      issueDate: issueDate!,
      validUntil: validUntil!,
      auditDate,
      status: status!,
    });
  });
  return { rows, errors, missingColumns };
}

/** Imports validated rows in one transaction (all or nothing). Returns the number imported. */
export async function importLegacyRows(rows: LegacyRow[], ctx: WorkflowContext): Promise<number> {
  const { numberFormat } = await getSettings();
  const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
  await prisma.$transaction(
    async (tx) => {
      const companyIds = new Map<string, string>();
      for (const row of rows) {
        const companyKey = `${row.company.name.toLowerCase()}|${row.company.postalCode ?? ""}`;
        let companyId = companyIds.get(companyKey);
        if (!companyId) {
          const found = await tx.company.findFirst({
            where: { name: { equals: row.company.name, mode: "insensitive" }, postalCode: row.company.postalCode },
            select: { id: true },
          });
          companyId = found?.id ?? (await tx.company.create({ data: row.company })).id;
          companyIds.set(companyKey, companyId);
        }
        const snapshot: CertificateSnapshot = {
          v: 1,
          certificateNumber: row.certificateNumber,
          revision: row.revision,
          company: { ...row.company, legalForm: null },
          productionSite: null,
          scope: row.scope,
          category: row.category,
          standards: row.standards,
          products: row.products.map((name) => ({ name, brand: null, articleNo: null, description: null })),
          issueDate: row.issueDate,
          validUntil: row.validUntil,
          auditDate: row.auditDate,
          signatory: null,
        };
        const created = await tx.certificate.create({
          data: {
            certificateNumber: row.certificateNumber,
            revision: row.revision,
            publicToken: generatePublicToken(),
            status: row.status,
            companyId,
            scope: row.scope,
            category: row.category,
            issueDate: toDate(row.issueDate),
            validUntil: toDate(row.validUntil),
            auditDate: row.auditDate ? toDate(row.auditDate) : null,
            isLegacy: true,
            templateVersion: CURRENT_TEMPLATE_VERSION,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            createdById: ctx.actorId,
            issuedById: ctx.actorId,
            issuedAt: toDate(row.issueDate),
            ...(row.status === "REVOKED" ? { revokedAt: new Date(), revokeReason: "Imported as revoked" } : {}),
            ...(row.status === "SUSPENDED" ? { suspendedAt: new Date(), suspendReason: "Imported as suspended" } : {}),
            products: { create: row.products.map((name, i) => ({ name, sortOrder: i })) },
            standards: { create: row.standardIds.map((standardId) => ({ standardId })) },
          },
        });
        await audit(
          {
            userId: ctx.actorId,
            action: "certificate.import",
            entityType: "Certificate",
            entityId: created.id,
            after: { certificateNumber: row.certificateNumber, revision: row.revision, status: row.status, line: row.line },
            ipHash: ctx.ipHash,
          },
          tx,
        );
        // Keep the yearly counter ahead of imported numbers in the current format.
        const parsed = parseCertificateNumber(row.certificateNumber, numberFormat);
        if (parsed) {
          await tx.$executeRaw`
            INSERT INTO "Counter" ("year", "lastNumber") VALUES (${parsed.year}, ${parsed.sequence})
            ON CONFLICT ("year") DO UPDATE SET "lastNumber" = GREATEST("Counter"."lastNumber", EXCLUDED."lastNumber")`;
        }
      }
      await audit(
        { userId: ctx.actorId, action: "certificate.import.batch", entityType: "Certificate", entityId: "batch", after: { count: rows.length }, ipHash: ctx.ipHash },
        tx,
      );
    },
    { timeout: 120_000 },
  );
  return rows.length;
}
