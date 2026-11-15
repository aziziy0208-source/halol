import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificatePreview } from "@/components/admin/certificate-preview";
import { Alert, buttonClass, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { issueProblems } from "@/certificates/draft-schema";
import { certificateHtml, findCertificate } from "@/certificates/load";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/certificates/snapshot";
import { formatDate, formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { DecisionPanel } from "../decision-panel";

export const metadata: Metadata = { title: "Approval" };

/** Approval window: the certificate exactly as it will be issued, the checklist and the decision. */
export default async function ApprovalPage({ params }: PageProps<"/admin/approvals/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.edit")) return <Forbidden />;
  const { id } = await params;
  const cert = await findCertificate(id);
  if (!cert) notFound();
  const m = (await adminT());
  const t = m.approvals;

  if (cert.status !== "PENDING_APPROVAL") {
    return (
      <>
        <Link href="/admin/approvals" className={`${buttonClass.link} mb-3 inline-block`}>
          ← {t.back}
        </Link>
        <Card className="space-y-3 p-6">
          <p className="text-sm text-slate-700">{t.notPending}</p>
          <Link href={`/admin/certificates/${cert.id}`} className={buttonClass.secondary}>
            {t.openCertificate}
          </Link>
        </Card>
      </>
    );
  }

  const [settings, creator, html] = await Promise.all([
    getSettings(),
    prisma.user.findUnique({ where: { id: cert.createdById }, select: { name: true } }),
    certificateHtml(cert, { assetBase: "", mode: "preview" }),
  ]);
  const problems = issueProblems({
    scope: cert.scope,
    standardIds: cert.standards.map((s) => s.standardId),
    issueDate: cert.issueDate ? toIsoDate(cert.issueDate) : null,
    validUntil: cert.validUntil ? toIsoDate(cert.validUntil) : null,
    signatoryId: cert.signatoryId,
  });
  if (cert.signatory && !cert.signatory.isActive) problems.push("signatoryInactive");
  const c = cert.company;
  const f = t.facts;
  const facts: [string, string][] = [
    [t.company, c.name],
    [f.address, [c.address, [c.postalCode, c.city].filter(Boolean).join(" "), c.country].filter(Boolean).join(", ")],
    [t.scope, cert.scope || m.common.none],
    [f.standards, cert.standards.map((s) => s.standard.code).join(", ") || m.common.none],
    [t.products, String(cert.products.length)],
    [f.validity, `${formatDate(cert.issueDate)} – ${formatDate(cert.validUntil)}`],
    [
      f.signatory,
      cert.signatory ? `${cert.signatory.name} (${cert.signatory.signatureImageKey ? f.signature : f.noSignature})` : m.common.none,
    ],
    [f.logo, c.logoImageKey ? f.yes : f.no],
    [t.submittedBy, `${creator?.name ?? m.common.none} · ${formatDateTime(cert.submittedAt)}`],
  ];
  const decides = can(user.role, "certificate.issue");

  return (
    <>
      <Link href="/admin/approvals" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.back}
      </Link>
      <PageHeader title={`${t.windowTitle}: ${c.name}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title={m.certificates.detail.preview}>
            <span className="text-xs text-slate-500">{m.certificates.detail.previewNote}</span>
          </CardHeader>
          <div className="p-3">
            <CertificatePreview html={html} title={`${t.windowTitle} ${c.name}`} />
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t.checklist} />
            <div className="space-y-4 p-5">
              {problems.length === 0 ? (
                <Alert tone="success">{t.ready}</Alert>
              ) : (
                <Alert tone="error">
                  <p className="font-medium">{t.missing}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {problems.map((p) => (
                      <li key={p}>{m.problems[p]}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
          {decides ? (
            <Card>
              <CardHeader title={t.windowTitle} />
              <DecisionPanel
                id={cert.id}
                ready={problems.length === 0}
                fourEyesBlocked={settings.fourEyes && cert.createdById === user.id}
                canChangeSettings={can(user.role, "settings.manage")}
              />
            </Card>
          ) : (
            <Card className="p-5 text-sm text-slate-600">{t.waitingOnly}</Card>
          )}
        </div>
      </div>
    </>
  );
}
