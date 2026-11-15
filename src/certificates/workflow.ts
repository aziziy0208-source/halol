import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { formatCertificateNumber } from "@/lib/certificates/number";
import { type CertificateSnapshot, toIsoDate } from "@/lib/certificates/snapshot";
import { businessToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { addMonths, getSettings } from "@/lib/settings";
import { certificateFileKeys, storage } from "@/lib/storage";
import { generatePublicToken } from "@/lib/tokens";
import { ASSET_ORIGIN } from "./assets";
import { type DraftData, type IssueProblem, issueProblems } from "./draft-schema";
import { documentFromSnapshot, isUnissued, type LoadedCertificate } from "./load";
import { renderPdf, renderPng } from "./renderer";
import { CURRENT_TEMPLATE_VERSION, renderCertificateHtml } from "./templates";

/**
 * Certificate state machine (spec §7.3–7.4). Every function re-validates the
 * current state inside the database, so double clicks and parallel requests
 * cannot issue twice or skip a step. Permissions are checked by the callers
 * (server actions); this layer enforces the business rules.
 *
 *   DRAFT ⇄ PENDING_APPROVAL → ACTIVE ⇄ SUSPENDED → REVOKED
 *                                ACTIVE/SUSPENDED → SUPERSEDED (when a new revision is issued)
 */

/** A rule violation; the admin dictionary (`workflowErrors`) turns the code into a message. */
export type WorkflowErrorCode =
  | "notFound"
  | "companyGone"
  | "standardGone"
  | "signatoryUnavailable"
  | "issuedNotEditable"
  | "onlyDraftsSubmit"
  | "incomplete"
  | "reasonMissing"
  | "reasonTooLong"
  | "onlyPendingReturn"
  | "issuedNotDeletable"
  | "numberReserved"
  | "alreadyIssued"
  | "fourEyes"
  | "issuedMeanwhile"
  | "statusNotAllowed"
  | "notRevisable";

export class WorkflowError extends Error {
  constructor(
    readonly code: WorkflowErrorCode,
    readonly detail: { problems?: IssueProblem[]; status?: string } = {},
  ) {
    super(code);
    this.name = "WorkflowError";
  }
}

export type WorkflowContext = { actorId: string; ipHash: string | null };

type Tx = Prisma.TransactionClient;

const certificateInclude = {
  company: true,
  signatory: true,
  products: { orderBy: { sortOrder: "asc" } },
  standards: { include: { standard: true } },
} as const;

const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
const iso = (date: Date | null) => (date ? toIsoDate(date) : null);

function summary(c: {
  companyId: string;
  scope: string;
  category: string | null;
  issueDate: Date | null;
  validUntil: Date | null;
  auditDate: Date | null;
  signatoryId: string | null;
}, extra: { standardIds: string[]; productCount: number }) {
  return {
    companyId: c.companyId,
    scope: c.scope,
    category: c.category,
    issueDate: iso(c.issueDate),
    validUntil: iso(c.validUntil),
    auditDate: iso(c.auditDate),
    signatoryId: c.signatoryId,
    ...extra,
  };
}

async function loadForUpdate(tx: Tx, id: string): Promise<LoadedCertificate> {
  await tx.$queryRaw`SELECT id FROM "Certificate" WHERE id = ${id} FOR UPDATE`;
  const cert = await tx.certificate.findUnique({ where: { id }, include: certificateInclude });
  if (!cert) throw new WorkflowError("notFound");
  return cert;
}

// ─── Drafts ─────────────────────────────────────────────────────────────────

/** Creates or updates a draft (optionally creating its company). Returns the certificate id. */
export async function saveDraft(input: DraftData, ctx: WorkflowContext): Promise<string> {
  return prisma.$transaction(async (tx) => {
    let companyId: string;
    if (input.company.mode === "new") {
      const company = await tx.company.create({ data: input.company.fields });
      await audit(
        { userId: ctx.actorId, action: "company.create", entityType: "Company", entityId: company.id, after: input.company.fields, ipHash: ctx.ipHash },
        tx,
      );
      companyId = company.id;
    } else {
      const company = await tx.company.findUnique({ where: { id: input.company.companyId }, select: { id: true } });
      if (!company) throw new WorkflowError("companyGone");
      companyId = company.id;
    }

    const standardIds = [...new Set(input.standardIds)];
    if (standardIds.length) {
      const found = await tx.standard.count({ where: { id: { in: standardIds } } });
      if (found !== standardIds.length) throw new WorkflowError("standardGone");
    }
    if (input.signatoryId) {
      const signatory = await tx.signatory.findUnique({ where: { id: input.signatoryId } });
      if (!signatory?.isActive) throw new WorkflowError("signatoryUnavailable");
    }

    const data = {
      companyId,
      productionSite: input.productionSite,
      scope: input.scope,
      category: input.category,
      issueDate: toDate(input.issueDate),
      validUntil: toDate(input.validUntil),
      auditDate: toDate(input.auditDate),
      signatoryId: input.signatoryId,
      notes: input.notes,
    };
    const products = input.products.map((p, i) => ({ ...p, sortOrder: i }));
    const after = summary(data, { standardIds, productCount: products.length });

    if (input.id) {
      const existing = await loadForUpdate(tx, input.id);
      if (!isUnissued(existing.status)) {
        throw new WorkflowError("issuedNotEditable");
      }
      // Editing a draft that waits for approval sends it back to DRAFT.
      // Drafts always follow the current template (older drafts move to it when edited).
      await tx.certificate.update({
        where: { id: existing.id },
        data: { ...data, status: "DRAFT", submittedAt: null, templateVersion: CURRENT_TEMPLATE_VERSION },
      });
      await tx.certificateProduct.deleteMany({ where: { certificateId: existing.id } });
      await tx.certificateStandard.deleteMany({ where: { certificateId: existing.id } });
      if (products.length) await tx.certificateProduct.createMany({ data: products.map((p) => ({ ...p, certificateId: existing.id })) });
      if (standardIds.length) await tx.certificateStandard.createMany({ data: standardIds.map((standardId) => ({ standardId, certificateId: existing.id })) });
      await audit(
        {
          userId: ctx.actorId,
          action: "certificate.draft.update",
          entityType: "Certificate",
          entityId: existing.id,
          before: summary(existing, { standardIds: existing.standards.map((s) => s.standardId), productCount: existing.products.length }),
          after,
          ipHash: ctx.ipHash,
        },
        tx,
      );
      return existing.id;
    }

    const created = await tx.certificate.create({
      data: {
        ...data,
        status: "DRAFT",
        publicToken: generatePublicToken(),
        templateVersion: CURRENT_TEMPLATE_VERSION,
        createdById: ctx.actorId,
        products: { create: products },
        standards: { create: standardIds.map((standardId) => ({ standardId })) },
      },
    });
    await audit(
      { userId: ctx.actorId, action: "certificate.draft.create", entityType: "Certificate", entityId: created.id, after, ipHash: ctx.ipHash },
      tx,
    );
    return created.id;
  });
}

function problemsOf(cert: LoadedCertificate): IssueProblem[] {
  const problems = issueProblems({
    scope: cert.scope,
    standardIds: cert.standards.map((s) => s.standardId),
    issueDate: iso(cert.issueDate),
    validUntil: iso(cert.validUntil),
    signatoryId: cert.signatoryId,
  });
  if (cert.signatory && !cert.signatory.isActive) problems.push("signatoryInactive");
  return problems;
}

/** ISSUER hands a complete draft to an admin (four-eyes principle). */
export async function submitForApproval(id: string, ctx: WorkflowContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cert = await loadForUpdate(tx, id);
    if (cert.status !== "DRAFT") throw new WorkflowError("onlyDraftsSubmit");
    const problems = problemsOf(cert);
    if (problems.length) throw new WorkflowError("incomplete", { problems });
    await tx.certificate.update({ where: { id }, data: { status: "PENDING_APPROVAL", submittedAt: new Date() } });
    await audit({ userId: ctx.actorId, action: "certificate.submit", entityType: "Certificate", entityId: id, ipHash: ctx.ipHash }, tx);
  });
}

/** An admin sends a submitted draft back to the issuer. */
export async function returnToDraft(id: string, reason: string, ctx: WorkflowContext): Promise<void> {
  const why = reason.trim();
  if (why.length < 3) throw new WorkflowError("reasonMissing");
  await prisma.$transaction(async (tx) => {
    const cert = await loadForUpdate(tx, id);
    if (cert.status !== "PENDING_APPROVAL") throw new WorkflowError("onlyPendingReturn");
    await tx.certificate.update({ where: { id }, data: { status: "DRAFT", submittedAt: null } });
    await audit(
      { userId: ctx.actorId, action: "certificate.return", entityType: "Certificate", entityId: id, after: { reason: why }, ipHash: ctx.ipHash },
      tx,
    );
  });
}

export async function deleteDraft(id: string, ctx: WorkflowContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cert = await loadForUpdate(tx, id);
    if (!isUnissued(cert.status)) throw new WorkflowError("issuedNotDeletable");
    if (cert.certificateNumber && cert.revision === 0) {
      throw new WorkflowError("numberReserved");
    }
    await tx.certificate.delete({ where: { id } });
    await audit(
      {
        userId: ctx.actorId,
        action: "certificate.draft.delete",
        entityType: "Certificate",
        entityId: id,
        before: summary(cert, { standardIds: cert.standards.map((s) => s.standardId), productCount: cert.products.length }),
        ipHash: ctx.ipHash,
      },
      tx,
    );
  });
}

// ─── Issuing ────────────────────────────────────────────────────────────────

/** Next free number for `year` (atomic counter; skips numbers taken by imported certificates). */
async function allocateNumber(tx: Tx, year: number, format: string): Promise<string> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO "Counter" ("year", "lastNumber") VALUES (${year}, 1)
      ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "Counter"."lastNumber" + 1
      RETURNING "lastNumber"`;
    const number = formatCertificateNumber(year, rows[0]!.lastNumber, format);
    const taken = await tx.certificate.findFirst({ where: { certificateNumber: number }, select: { id: true } });
    if (!taken) return number;
  }
  throw new Error(`No free certificate number for ${year}`);
}

export function buildSnapshot(cert: LoadedCertificate, certificateNumber: string): CertificateSnapshot {
  return {
    v: 1,
    certificateNumber,
    revision: cert.revision,
    company: {
      name: cert.company.name,
      legalForm: cert.company.legalForm,
      address: cert.company.address,
      postalCode: cert.company.postalCode,
      city: cert.company.city,
      country: cert.company.country,
    },
    productionSite: cert.productionSite,
    scope: cert.scope,
    category: cert.category,
    standards: cert.standards
      .map((s) => ({ code: s.standard.code, title: s.standard.title }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    products: cert.products.map((p) => ({ name: p.name, brand: p.brand, articleNo: p.articleNo, description: p.description })),
    issueDate: iso(cert.issueDate)!,
    validUntil: iso(cert.validUntil)!,
    auditDate: iso(cert.auditDate),
    signatory: cert.signatory ? { name: cert.signatory.name, title: cert.signatory.title } : null,
    signatureImageKey: cert.signatory?.signatureImageKey ?? null,
    stampImageKey: cert.signatory?.stampImageKey ?? null,
    companyLogoKey: cert.company.logoImageKey ?? null,
  };
}

/**
 * Issues a draft (spec §7.3): number → token → snapshot → QR + PDF/PNG →
 * private storage with SHA-256 → ACTIVE → audit. Rendering cannot run inside a
 * database transaction, so it happens between two transactions; if it fails,
 * the reserved number stays with the draft and a retry continues with it.
 */
export async function issueCertificate(id: string, ctx: WorkflowContext): Promise<{ certificateNumber: string; revision: number }> {
  const settings = await getSettings();

  const prepared = await prisma.$transaction(async (tx) => {
    const cert = await loadForUpdate(tx, id);
    if (!isUnissued(cert.status)) throw new WorkflowError("alreadyIssued");
    if (settings.fourEyes && cert.createdById === ctx.actorId) {
      throw new WorkflowError("fourEyes");
    }
    const problems = problemsOf(cert);
    if (problems.length) throw new WorkflowError("incomplete", { problems });

    const certificateNumber = cert.certificateNumber ?? (await allocateNumber(tx, cert.issueDate!.getUTCFullYear(), settings.numberFormat));
    const publicToken = cert.publicToken ?? generatePublicToken();
    const snapshot = buildSnapshot(cert, certificateNumber);
    await tx.certificate.update({
      where: { id },
      // Issued with the current template; the version is frozen with the certificate from now on.
      data: { certificateNumber, publicToken, snapshot: snapshot as unknown as Prisma.InputJsonValue, templateVersion: CURRENT_TEMPLATE_VERSION },
    });
    return { certificateNumber, publicToken, snapshot, revision: cert.revision, templateVersion: CURRENT_TEMPLATE_VERSION };
  });

  const doc = await documentFromSnapshot(prepared.snapshot, prepared.publicToken);
  const html = renderCertificateHtml(prepared.templateVersion, doc, { assetBase: ASSET_ORIGIN, mode: "print" });
  const { pdf } = await renderPdf(html);
  const preview = await renderPng(html, { scale: 2 });
  const keys = certificateFileKeys(prepared.certificateNumber, prepared.revision);
  await storage().put(keys.pdf, pdf, "application/pdf");
  await storage().put(keys.preview, preview, "image/png");
  const pdfSha256 = createHash("sha256").update(pdf).digest("hex");

  await prisma.$transaction(async (tx) => {
    const activated = await tx.certificate.updateMany({
      where: { id, status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
      data: { status: "ACTIVE", issuedAt: new Date(), issuedById: ctx.actorId, pdfKey: keys.pdf, previewKey: keys.preview, pdfSha256 },
    });
    if (activated.count === 0) throw new WorkflowError("issuedMeanwhile");

    // Spec §7.4: the previous revision becomes SUPERSEDED and points to the new one.
    const older = await tx.certificate.findMany({
      where: { certificateNumber: prepared.certificateNumber, id: { not: id }, status: { in: ["ACTIVE", "SUSPENDED"] } },
      select: { id: true, status: true, revision: true },
    });
    for (const o of older) {
      await tx.certificate.update({ where: { id: o.id }, data: { status: "SUPERSEDED", supersededById: id } });
      await audit(
        {
          userId: ctx.actorId,
          action: "certificate.supersede",
          entityType: "Certificate",
          entityId: o.id,
          before: { status: o.status, revision: o.revision },
          after: { status: "SUPERSEDED", supersededById: id, byRevision: prepared.revision },
          ipHash: ctx.ipHash,
        },
        tx,
      );
    }
    await audit(
      {
        userId: ctx.actorId,
        action: "certificate.issue",
        entityType: "Certificate",
        entityId: id,
        after: {
          certificateNumber: prepared.certificateNumber,
          revision: prepared.revision,
          pdfSha256,
          templateVersion: prepared.templateVersion,
        },
        ipHash: ctx.ipHash,
      },
      tx,
    );
  });
  return { certificateNumber: prepared.certificateNumber, revision: prepared.revision };
}

// ─── Status changes ─────────────────────────────────────────────────────────

export type StatusAction = "suspend" | "reactivate" | "revoke";

const TRANSITIONS = {
  suspend: { from: ["ACTIVE"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "ACTIVE" },
  revoke: { from: ["ACTIVE", "SUSPENDED"], to: "REVOKED" },
} as const;

/** Suspend / reactivate / revoke — a reason is always required (spec §7.3.4). */
export async function changeStatus(id: string, action: StatusAction, reason: string, ctx: WorkflowContext): Promise<void> {
  const why = reason.trim();
  if (why.length < 3) throw new WorkflowError("reasonMissing");
  if (why.length > 500) throw new WorkflowError("reasonTooLong");
  const rule = TRANSITIONS[action];
  const now = new Date();
  const data =
    action === "suspend"
      ? { status: rule.to, suspendedAt: now, suspendReason: why }
      : action === "reactivate"
        ? { status: rule.to, suspendedAt: null, suspendReason: null }
        : { status: rule.to, revokedAt: now, revokeReason: why };

  await prisma.$transaction(async (tx) => {
    const cert = await loadForUpdate(tx, id);
    if (!(rule.from as readonly string[]).includes(cert.status)) {
      throw new WorkflowError("statusNotAllowed", { status: cert.status });
    }
    await tx.certificate.update({ where: { id }, data });
    await audit(
      {
        userId: ctx.actorId,
        action: `certificate.${action}`,
        entityType: "Certificate",
        entityId: id,
        before: { status: cert.status },
        after: { status: rule.to, reason: why },
        ipHash: ctx.ipHash,
      },
      tx,
    );
  });
}

// ─── Revisions and renewals ─────────────────────────────────────────────────

function copyOf(cert: LoadedCertificate) {
  return {
    companyId: cert.companyId,
    productionSite: cert.productionSite,
    scope: cert.scope,
    category: cert.category,
    signatoryId: cert.signatory?.isActive ? cert.signatoryId : null,
    templateVersion: CURRENT_TEMPLATE_VERSION,
    products: {
      create: cert.products.map((p, i) => ({ name: p.name, brand: p.brand, articleNo: p.articleNo, description: p.description, sortOrder: i })),
    },
    standards: { create: cert.standards.filter((s) => s.standard.isActive).map((s) => ({ standardId: s.standardId })) },
  };
}

/**
 * Correction of an issued certificate (spec §7.4): same number, revision + 1,
 * new token, new PDF on issue; the old revision becomes SUPERSEDED then.
 * If a revision draft already exists, it is returned instead of creating another.
 */
export async function createRevision(id: string, ctx: WorkflowContext): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const cert = await loadForUpdate(tx, id);
    if (!["ACTIVE", "SUSPENDED"].includes(cert.status) || !cert.certificateNumber) {
      throw new WorkflowError("notRevisable");
    }
    const open = await tx.certificate.findFirst({
      where: { certificateNumber: cert.certificateNumber, status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
      select: { id: true },
    });
    if (open) return open.id;
    const max = await tx.certificate.aggregate({ where: { certificateNumber: cert.certificateNumber }, _max: { revision: true } });
    const revision = (max._max.revision ?? cert.revision) + 1;
    const created = await tx.certificate.create({
      data: {
        ...copyOf(cert),
        certificateNumber: cert.certificateNumber,
        revision,
        status: "DRAFT",
        publicToken: generatePublicToken(),
        issueDate: businessToday(),
        validUntil: cert.validUntil,
        auditDate: cert.auditDate,
        notes: `Revision ${revision} of ${cert.certificateNumber}`,
        createdById: ctx.actorId,
      },
    });
    await audit(
      {
        userId: ctx.actorId,
        action: "certificate.revision.create",
        entityType: "Certificate",
        entityId: created.id,
        after: { certificateNumber: cert.certificateNumber, revision, sourceId: id },
        ipHash: ctx.ipHash,
      },
      tx,
    );
    return created.id;
  });
}

/** Renewal / similar certificate: a new draft (new number on issue) with the same content. */
export async function duplicateAsDraft(id: string, ctx: WorkflowContext): Promise<string> {
  const { defaultValidityMonths } = await getSettings();
  return prisma.$transaction(async (tx) => {
    const cert = await tx.certificate.findUnique({ where: { id }, include: certificateInclude });
    if (!cert) throw new WorkflowError("notFound");
    const today = toIsoDate(businessToday());
    const created = await tx.certificate.create({
      data: {
        ...copyOf(cert),
        status: "DRAFT",
        publicToken: generatePublicToken(),
        issueDate: toDate(today),
        validUntil: toDate(addMonths(today, defaultValidityMonths)),
        createdById: ctx.actorId,
      },
    });
    await audit(
      {
        userId: ctx.actorId,
        action: "certificate.draft.create",
        entityType: "Certificate",
        entityId: created.id,
        after: { copiedFrom: id, certificateNumber: cert.certificateNumber },
        ipHash: ctx.ipHash,
      },
      tx,
    );
    return created.id;
  });
}
