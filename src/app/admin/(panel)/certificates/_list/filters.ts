import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { parseDate } from "@/lib/csv";

/** Certificate list filters, shared by the list page and the CSV/Excel export. */

export const STATUS_FILTERS = ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED", "SUPERSEDED"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ["newest", "number", "company", "issueDate", "validUntil"] as const;
export type Sort = (typeof SORTS)[number];

export type ListFilters = {
  q: string;
  status: StatusFilter | "";
  category: string;
  from: string;
  to: string;
  sort: Sort;
};

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export function parseFilters(params: Params): ListFilters {
  const status = first(params.status);
  const sort = first(params.sort);
  return {
    q: first(params.q).slice(0, 100),
    status: (STATUS_FILTERS as readonly string[]).includes(status) ? (status as StatusFilter) : "",
    category: first(params.category).slice(0, 200),
    from: parseDate(first(params.from)) ?? "",
    to: parseDate(first(params.to)) ?? "",
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : "newest",
  };
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function filterWhere(f: ListFilters, today: Date): Prisma.CertificateWhereInput {
  const and: Prisma.CertificateWhereInput[] = [];
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    and.push({
      OR: [{ certificateNumber: contains }, { company: { name: contains } }, { products: { some: { name: contains } } }],
    });
  }
  if (f.status === "ACTIVE") and.push({ status: "ACTIVE", validUntil: { gte: today } });
  else if (f.status === "EXPIRED") and.push({ status: "ACTIVE", validUntil: { lt: today } });
  else if (f.status) and.push({ status: f.status });
  if (f.category) and.push({ category: { equals: f.category, mode: "insensitive" } });
  if (f.from) and.push({ issueDate: { gte: day(f.from) } });
  if (f.to) and.push({ issueDate: { lte: day(f.to) } });
  return and.length ? { AND: and } : {};
}

export function filterOrderBy(sort: Sort): Prisma.CertificateOrderByWithRelationInput[] {
  switch (sort) {
    case "number":
      return [{ certificateNumber: { sort: "asc", nulls: "last" } }, { revision: "asc" }];
    case "company":
      return [{ company: { name: "asc" } }, { createdAt: "desc" }];
    case "issueDate":
      return [{ issueDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "validUntil":
      return [{ validUntil: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
    default:
      return [{ updatedAt: "desc" }];
  }
}

/** Query string of the active filters (for pagination and export links). */
export function filterParams(f: ListFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v && !(k === "sort" && v === "newest")) out[k] = v;
  return out;
}
