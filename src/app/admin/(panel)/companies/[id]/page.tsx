import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateStatusBadge } from "@/components/admin/certificate-status";
import { Alert, buttonClass, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { imageDataUri } from "@/certificates/load";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { effectiveStatus } from "@/lib/certificates/status";
import { businessToday, formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { CompanyForm, DeleteCompanyButton } from "../company-form";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params, searchParams }: PageProps<"/admin/companies/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "company.view")) return <Forbidden />;
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      certificates: {
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, certificateNumber: true, revision: true, status: true, issueDate: true, validUntil: true, isLegacy: true },
      },
    },
  });
  if (!company) notFound();

  const t = (await adminT());
  const today = businessToday();
  const logo = await imageDataUri(company.logoImageKey);
  const logoInvalid = (await searchParams).logo === "invalid";
  const canEdit = can(user.role, "company.edit");
  const defaults = {
    name: company.name,
    legalForm: company.legalForm ?? "",
    address: company.address,
    postalCode: company.postalCode ?? "",
    city: company.city ?? "",
    country: company.country,
    registrationNo: company.registrationNo ?? "",
    contactPerson: company.contactPerson ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
  };

  return (
    <>
      <Link href="/admin/companies" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.companies.back}
      </Link>
      <PageHeader title={company.name}>
        {can(user.role, "certificate.edit") ? (
          <Link href={`/admin/certificates/new?company=${company.id}`} className={buttonClass.primary}>
            {t.companies.newCertificate}
          </Link>
        ) : null}
      </PageHeader>

      {logoInvalid ? (
        <div className="mb-4">
          <Alert tone="error">{t.companies.badLogo}</Alert>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={t.companies.certificates} />
          {company.certificates.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">{t.companies.noCertificates}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-2 font-medium">{t.certificates.number}</th>
                    <th className="px-5 py-2 font-medium">{t.certificates.status}</th>
                    <th className="px-5 py-2 font-medium whitespace-nowrap">{t.certificates.validUntil}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {company.certificates.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 font-mono whitespace-nowrap">
                        <Link href={`/admin/certificates/${c.id}`} className="font-medium text-brand-ink hover:underline">
                          {c.certificateNumber ?? t.certificates.draft}
                          {c.revision > 0 ? ` / Rev. ${c.revision}` : ""}
                        </Link>
                        {c.isLegacy ? <span className="ml-2 font-sans text-xs text-slate-500">{t.certificates.list.legacy}</span> : null}
                      </td>
                      <td className="px-5 py-2.5">
                        <CertificateStatusBadge status={effectiveStatus(c.status, c.validUntil, today)} />
                      </td>
                      <td className="px-5 py-2.5 tabular-nums">{formatDate(c.validUntil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t.companies.details} />
            <CompanyForm id={company.id} defaults={defaults} readOnly={!canEdit} logo={logo} />
          </Card>
          {canEdit && company.certificates.length === 0 ? (
            <Card className="p-5">
              <DeleteCompanyButton id={company.id} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
