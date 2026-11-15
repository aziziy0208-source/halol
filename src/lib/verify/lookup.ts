import "server-only";
import type { CertificateSnapshot } from "@/lib/certificates/snapshot";
import { toIsoDate } from "@/lib/certificates/snapshot";
import { effectiveStatus } from "@/lib/certificates/status";
import { BUSINESS_TIME_ZONE, businessToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { isPublicToken } from "@/lib/tokens";

/**
 * What the public verification page may show about a certificate (spec §8.2).
 * Content comes from the snapshot frozen at issue; the status is always live.
 * Drafts and certificates awaiting approval are never found.
 */
export type PublicStatus = "VALID" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "SUPERSEDED";

export type PublicCertificate = {
  /** Internal id, for the scan log only — never rendered. */
  id: string;
  token: string;
  number: string;
  revision: number;
  status: PublicStatus;
  /** Berlin calendar date of the suspension / revocation (YYYY-MM-DD). */
  statusSince: string | null;
  company: { name: string; legalForm: string | null; address: string; postalCode: string | null; city: string | null; country: string };
  productionSite: string | null;
  scope: string;
  category: string | null;
  standards: { code: string; title: string }[];
  products: { name: string; brand: string | null; articleNo: string | null }[];
  issueDate: string;
  validUntil: string;
  isLegacy: boolean;
  /** PDF + preview image are offered only while the certificate is valid. */
  documentAvailable: boolean;
  /** For SUPERSEDED: the current revision's link. */
  current: { token: string; revision: number } | null;
};

const HIDDEN = ["DRAFT", "PENDING_APPROVAL"] as const;

const select = {
  id: true,
  publicToken: true,
  certificateNumber: true,
  revision: true,
  status: true,
  validUntil: true,
  issueDate: true,
  suspendedAt: true,
  revokedAt: true,
  supersededById: true,
  isLegacy: true,
  snapshot: true,
  scope: true,
  category: true,
  productionSite: true,
  company: true,
  products: { orderBy: { sortOrder: "asc" as const }, select: { name: true, brand: true, articleNo: true } },
  standards: { select: { standard: { select: { code: true, title: true } } } },
} as const;

const berlinDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(d) : null;

async function currentRevision(supersededById: string | null): Promise<PublicCertificate["current"]> {
  let nextId = supersededById;
  for (let hops = 0; nextId && hops < 50; hops++) {
    const next = await prisma.certificate.findUnique({
      where: { id: nextId },
      select: { publicToken: true, revision: true, status: true, supersededById: true },
    });
    if (!next || (HIDDEN as readonly string[]).includes(next.status) || !next.publicToken) return null;
    if (!next.supersededById) return { token: next.publicToken, revision: next.revision };
    nextId = next.supersededById;
  }
  return null;
}

type Row = NonNullable<Awaited<ReturnType<typeof findRow>>>;

function findRow(where: { publicToken: string } | { id: string }) {
  return prisma.certificate.findFirst({ where: { ...where, status: { notIn: [...HIDDEN] } }, select });
}

async function toPublic(row: Row): Promise<PublicCertificate | null> {
  if (!row.publicToken || !row.certificateNumber || !row.issueDate || !row.validUntil) return null;
  const snap = row.snapshot as unknown as CertificateSnapshot | null;
  const live = effectiveStatus(row.status, row.validUntil, businessToday());
  const status: PublicStatus = live === "ACTIVE" ? "VALID" : (live as PublicStatus);
  return {
    id: row.id,
    token: row.publicToken,
    number: row.certificateNumber,
    revision: row.revision,
    status,
    statusSince: status === "SUSPENDED" ? berlinDate(row.suspendedAt) : status === "REVOKED" ? berlinDate(row.revokedAt) : null,
    company: snap?.company ?? {
      name: row.company.name,
      legalForm: row.company.legalForm,
      address: row.company.address,
      postalCode: row.company.postalCode,
      city: row.company.city,
      country: row.company.country,
    },
    productionSite: snap ? snap.productionSite : row.productionSite,
    scope: snap ? snap.scope : row.scope,
    category: snap ? snap.category : row.category,
    standards: snap?.standards ?? row.standards.map((s) => s.standard),
    products: (snap?.products ?? row.products).map((p) => ({ name: p.name, brand: p.brand, articleNo: p.articleNo })),
    issueDate: snap?.issueDate ?? toIsoDate(row.issueDate),
    validUntil: snap?.validUntil ?? toIsoDate(row.validUntil),
    isLegacy: row.isLegacy,
    documentAvailable: status === "VALID" && !row.isLegacy,
    current: status === "SUPERSEDED" ? await currentRevision(row.supersededById) : null,
  };
}

export async function findPublicByToken(token: string): Promise<PublicCertificate | null> {
  if (!isPublicToken(token)) return null;
  const row = await findRow({ publicToken: token });
  return row ? toPublic(row) : null;
}

/** "whu 2026 00001", "WHU–2026–00001" … → "WHU-2026-00001" */
export function normalizeCertificateNumber(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .slice(0, 60);
}

/** Manual check: the newest issued revision of a number (case-insensitive). Returns its public token. */
export async function findTokenByNumber(raw: string): Promise<string | null> {
  const number = normalizeCertificateNumber(raw);
  if (number.length < 3) return null;
  const row = await prisma.certificate.findFirst({
    where: { certificateNumber: { equals: number, mode: "insensitive" }, status: { notIn: [...HIDDEN] }, publicToken: { not: null } },
    orderBy: { revision: "desc" },
    select: { publicToken: true },
  });
  return row?.publicToken ?? null;
}
