import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificatePreview } from "@/components/admin/certificate-preview";
import { CertificateStatusBadge } from "@/components/admin/certificate-status";
import { Alert, buttonClass, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { certificateHtml, findCertificate, isUnissued } from "@/certificates/load";
import { verificationUrl } from "@/certificates/qr";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { effectiveStatus } from "@/lib/certificates/status";
import { businessToday, formatDate, formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { WorkflowActions } from "./workflow-actions";

export const metadata: Metadata = { title: "Certificate" };

const HISTORY_LIMIT = 100;
const SCAN_LIMIT = 50;

export default async function CertificatePage({ params }: PageProps<"/admin/certificates/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.view")) return <Forbidden />;
  const { id } = await params;
  const cert = await findCertificate(id);
  if (!cert) notFound();

  const m = (await adminT());
  const t = m.certificates;
  const tw = m.workflow;
  const canSeeAudit = can(user.role, "audit.view");
  const [settings, people, revisions, history, scans, scanCount] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where: { id: { in: [cert.createdById, cert.issuedById].filter((x): x is string => Boolean(x)) } },
      select: { id: true, name: true },
    }),
    cert.certificateNumber
      ? prisma.certificate.findMany({
          where: { certificateNumber: cert.certificateNumber },
          orderBy: { revision: "asc" },
          select: { id: true, revision: true, status: true, validUntil: true },
        })
      : Promise.resolve([]),
    canSeeAudit
      ? prisma.auditLog.findMany({
          where: { entityType: "Certificate", entityId: cert.id },
          orderBy: { createdAt: "desc" },
          take: HISTORY_LIMIT,
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.scanLog.findMany({ where: { certificateId: cert.id }, orderBy: { scannedAt: "desc" }, take: SCAN_LIMIT }),
    prisma.scanLog.count({ where: { certificateId: cert.id } }),
  ]);
  const nameOf = (userId: string | null) => people.find((p) => p.id === userId)?.name ?? m.common.none;

  const today = businessToday();
  const status = effectiveStatus(cert.status, cert.validUntil, today);
  const unissued = isUnissued(cert.status);
  const html = cert.isLegacy ? null : await certificateHtml(cert, { assetBase: "", mode: "preview" });
  const files = `/admin/certificates/${cert.id}/files`;
  const verifyUrl = !unissued && cert.publicToken ? verificationUrl(siteUrl(), cert.publicToken) : null;
  const title = `${cert.certificateNumber ?? t.draft}${cert.revision > 0 ? ` / Rev. ${cert.revision}` : ""}`;

  const facts: [string, string][] = [
    [t.company, cert.company.name],
    [t.detail.scope, cert.scope || m.common.none],
    [tw.category, cert.category ?? m.common.none],
    [tw.standards, cert.standards.map((s) => s.standard.code).join(", ") || m.common.none],
    [tw.productionSite, cert.productionSite ?? m.common.none],
    [t.detail.issueDate, formatDate(cert.issueDate)],
    [t.validUntil, formatDate(cert.validUntil)],
    [t.detail.auditDate, formatDate(cert.auditDate)],
    [t.products, String(cert.products.length)],
    [tw.signatory, cert.signatory ? `${cert.signatory.name}, ${cert.signatory.title}` : m.common.none],
    [tw.createdBy, `${nameOf(cert.createdById)} · ${formatDateTime(cert.createdAt)}`],
    ...(cert.submittedAt ? [[tw.submittedAt, formatDateTime(cert.submittedAt)] as [string, string]] : []),
    ...(cert.issuedAt ? [[tw.issuedBy, `${nameOf(cert.issuedById)} · ${formatDateTime(cert.issuedAt)}`] as [string, string]] : []),
    [t.detail.template, `v${cert.templateVersion}`],
  ];

  return (
    <>
      <Link href="/admin/certificates" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.detail.back}
      </Link>
      <PageHeader title={title}>
        <div className="flex items-center gap-2">
          {cert.isLegacy ? <span className="text-xs text-slate-500">{tw.legacy}</span> : null}
          <CertificateStatusBadge status={status} />
        </div>
      </PageHeader>

      {cert.status === "SUSPENDED" && cert.suspendReason ? (
        <div className="mb-4">
          <Alert tone="info">
            {tw.suspendedReason} ({formatDateTime(cert.suspendedAt)}): {cert.suspendReason}
          </Alert>
        </div>
      ) : null}
      {cert.status === "REVOKED" && cert.revokeReason ? (
        <div className="mb-4">
          <Alert tone="error">
            {tw.revokedReason} ({formatDateTime(cert.revokedAt)}): {cert.revokeReason}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {html ? (
            <Card>
              <CardHeader title={t.detail.preview}>
                <span className="text-xs text-slate-500">{t.detail.previewNote}</span>
              </CardHeader>
              <div className="p-3">
                <CertificatePreview html={html} title={`${t.detail.preview} ${title}`} />
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="mb-2 font-sans text-base font-semibold text-slate-900">{tw.legacy}</h2>
              <p className="text-sm text-slate-600">{tw.legacyNote}</p>
              {cert.products.length ? (
                <ul className="mt-4 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                  {cert.products.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
          )}

          {canSeeAudit ? (
            <Card>
              <CardHeader title={tw.history} />
              {history.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">{tw.noHistory}</p>
              ) : (
                <ol className="divide-y divide-slate-100 text-sm">
                  {history.map((e) => {
                    const after = e.after as Record<string, unknown> | null;
                    const reason = after && typeof after.reason === "string" ? after.reason : null;
                    return (
                      <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-2.5">
                        <span className="w-36 shrink-0 text-slate-500 tabular-nums">{formatDateTime(e.createdAt)}</span>
                        <span className="font-mono text-xs leading-5">{e.action}</span>
                        <span className="text-slate-600">{e.user?.name ?? m.audit.system}</span>
                        {reason ? <span className="w-full text-slate-700 sm:pl-40">“{reason}”</span> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={tw.actions} />
            <WorkflowActions
              id={cert.id}
              status={status}
              canEdit={can(user.role, "certificate.edit")}
              canIssue={can(user.role, "certificate.issue")}
              fourEyesBlocked={settings.fourEyes && cert.createdById === user.id}
              deletable={!(cert.certificateNumber && cert.revision === 0)}
            />
          </Card>

          <Card>
            <CardHeader title={t.detail.downloads} />
            <div className="flex flex-wrap gap-2 p-5">
              {cert.isLegacy ? null : (
                <>
                  <a href={`${files}/certificate.pdf`} className={buttonClass.primary}>
                    {t.detail.pdf}
                  </a>
                  <a href={`${files}/certificate.png`} className={buttonClass.secondary}>
                    {t.detail.png}
                  </a>
                </>
              )}
              {verifyUrl ? (
                <>
                  <a href={`${files}/qr.svg`} className={buttonClass.secondary}>
                    {t.detail.qrSvg}
                  </a>
                  <a href={`${files}/qr.png`} className={buttonClass.secondary}>
                    {t.detail.qrPng}
                  </a>
                </>
              ) : (
                <p className="w-full text-xs text-slate-500">{t.detail.noQr}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.detail.facts} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {cert.notes ? (
              <div className="border-t border-slate-200 px-5 py-4 text-sm">
                <p className="mb-1 text-slate-500">{tw.notes}</p>
                <p className="whitespace-pre-line">{cert.notes}</p>
              </div>
            ) : null}
            {verifyUrl ? (
              <div className="border-t border-slate-200 px-5 py-4 text-sm">
                <p className="mb-1 text-slate-500">{t.detail.verifyLink}</p>
                <p className="font-mono text-xs break-all text-slate-800 select-all">{verifyUrl}</p>
              </div>
            ) : null}
            {!unissued && !cert.isLegacy ? (
              <div className="border-t border-slate-200 px-5 py-4 text-sm">
                <p className="mb-1 text-slate-500">{t.detail.files}</p>
                {cert.pdfSha256 ? (
                  <p className="text-xs">
                    {t.detail.filesStored} <span className="font-mono break-all">{cert.pdfSha256}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">{t.detail.filesPending}</p>
                )}
              </div>
            ) : null}
          </Card>

          {revisions.length > 1 ? (
            <Card>
              <CardHeader title={tw.revisions} />
              <ul className="divide-y divide-slate-100 text-sm">
                {revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    {r.id === cert.id ? (
                      <span className="font-medium">
                        {tw.revisionLabel(r.revision)} <span className="text-xs font-normal text-slate-500">({tw.thisRevision})</span>
                      </span>
                    ) : (
                      <Link href={`/admin/certificates/${r.id}`} className="font-medium text-brand-ink hover:underline">
                        {tw.revisionLabel(r.revision)}
                      </Link>
                    )}
                    <CertificateStatusBadge status={effectiveStatus(r.status, r.validUntil, today)} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {!unissued ? (
            <Card>
              <CardHeader title={`${tw.scans} (${scanCount})`} />
              {scans.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">{tw.noScans}</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {scans.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 px-5 py-2">
                      <span className="tabular-nums">{formatDateTime(s.scannedAt)}</span>
                      <span className="text-slate-500">
                        {tw.channels[s.channel]}
                        {s.country ? ` · ${s.country}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
