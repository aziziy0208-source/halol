import writeXlsxFile from "write-excel-file/node";
import { verificationUrl } from "@/certificates/qr";
import { requireUser } from "@/lib/auth/current-user";
import { requestContext } from "@/lib/auth/login";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { effectiveStatus } from "@/lib/certificates/status";
import { toIsoDate } from "@/lib/certificates/snapshot";
import { toCsv } from "@/lib/csv";
import { businessToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { fileResponse } from "@/lib/http";
import { filterOrderBy, filterParams, filterWhere, parseFilters } from "../_list/filters";

const MAX_ROWS = 20_000;

const HEADERS = [
  "Certificate number",
  "Revision",
  "Status",
  "Company",
  "Address",
  "Postal code",
  "City",
  "Country",
  "Scope",
  "Category",
  "Standards",
  "Products",
  "Issue date",
  "Valid until",
  "Audit date",
  "Legacy",
  "Verification URL",
];

/** CSV / Excel export of the filtered certificate list (same filters as the list page). */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!can(user.role, "certificate.view")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters = parseFilters(Object.fromEntries(url.searchParams));
  const today = businessToday();

  const certificates = await prisma.certificate.findMany({
    where: filterWhere(filters, today),
    orderBy: filterOrderBy(filters.sort),
    take: MAX_ROWS,
    include: {
      company: true,
      standards: { include: { standard: { select: { code: true } } } },
      _count: { select: { products: true } },
    },
  });

  const base = siteUrl();
  const iso = (d: Date | null) => (d ? toIsoDate(d) : "");
  const rows = certificates.map((c) => {
    const issued = c.status !== "DRAFT" && c.status !== "PENDING_APPROVAL";
    return [
      c.certificateNumber ?? "",
      c.revision,
      effectiveStatus(c.status, c.validUntil, today),
      c.company.name,
      c.company.address,
      c.company.postalCode ?? "",
      c.company.city ?? "",
      c.company.country,
      c.scope,
      c.category ?? "",
      c.standards.map((s) => s.standard.code).join(" | "),
      c._count.products,
      iso(c.issueDate),
      iso(c.validUntil),
      iso(c.auditDate),
      c.isLegacy ? "yes" : "",
      issued && c.publicToken ? verificationUrl(base, c.publicToken) : "",
    ] as (string | number)[];
  });

  const { ipHash } = await requestContext();
  await audit({
    userId: user.id,
    action: "certificate.export",
    entityType: "Certificate",
    entityId: "list",
    after: { format, count: rows.length, filters: filterParams(filters) },
    ipHash,
  });

  const name = `whu-certificates-${toIsoDate(today)}`;
  if (format === "csv") {
    return fileResponse(Buffer.from(toCsv([HEADERS, ...rows]), "utf8"), "text/csv; charset=utf-8", `${name}.csv`);
  }
  const header = HEADERS.map((value) => ({ value, fontWeight: "bold" as const }));
  const body = rows.map((r) => r.map((value) => (value === "" ? null : { value })));
  const buffer = await writeXlsxFile([header, ...body]).toBuffer();
  return fileResponse(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${name}.xlsx`);
}
