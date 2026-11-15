import type { Metadata } from "next";
import Link from "next/link";
import { CertificateStatusBadge } from "@/components/admin/certificate-status";
import { listHref, PAGE_SIZE, pageParam, Pagination } from "@/components/admin/pagination";
import { buttonClass, Card, inputBase, labelClass, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { effectiveStatus } from "@/lib/certificates/status";
import { businessToday, formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { filterOrderBy, filterParams, filterWhere, parseFilters, SORTS, STATUS_FILTERS } from "./_list/filters";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage({ searchParams }: PageProps<"/admin/certificates">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.view")) return <Forbidden />;
  const t = (await adminT()).certificates;
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const page = pageParam(sp.page);
  const today = businessToday();
  const where = filterWhere(filters, today);

  const [total, certificates, categories] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      orderBy: filterOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        certificateNumber: true,
        revision: true,
        status: true,
        issueDate: true,
        validUntil: true,
        isLegacy: true,
        company: { select: { name: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.certificate.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
      take: 100,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = filterParams(filters);
  const exportHref = (format: "csv" | "xlsx") => listHref("/admin/certificates/export", { ...params, format });

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle}>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/certificates/template" className={buttonClass.secondary}>
            {t.templatePreview}
          </Link>
          {can(user.role, "certificate.edit") ? (
            <Link href="/admin/certificates/new" className={buttonClass.primary}>
              {t.newCertificate}
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <Card className="mb-4">
        <form role="search" className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto_1fr]">
          <div>
            <label htmlFor="f-q" className={labelClass}>
              {t.list.search}
            </label>
            <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder={t.list.searchPlaceholder} className={`${inputBase} w-full`} />
          </div>
          <div>
            <label htmlFor="f-status" className={labelClass}>
              {t.list.status}
            </label>
            <select id="f-status" name="status" defaultValue={filters.status} className={`${inputBase} w-full`}>
              <option value="">{t.list.anyStatus}</option>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {t.statuses[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-category" className={labelClass}>
              {t.list.category}
            </label>
            <select id="f-category" name="category" defaultValue={filters.category} className={`${inputBase} w-full`}>
              <option value="">{t.list.anyCategory}</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category ?? ""}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-from" className={labelClass}>
              {t.list.from}
            </label>
            <input id="f-from" name="from" type="date" defaultValue={filters.from} className={`${inputBase} w-full`} />
          </div>
          <div>
            <label htmlFor="f-to" className={labelClass}>
              {t.list.to}
            </label>
            <input id="f-to" name="to" type="date" defaultValue={filters.to} className={`${inputBase} w-full`} />
          </div>
          <div>
            <label htmlFor="f-sort" className={labelClass}>
              {t.list.sort}
            </label>
            <select id="f-sort" name="sort" defaultValue={filters.sort} className={`${inputBase} w-full`}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.list.sorts[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
            <button type="submit" className={buttonClass.primary}>
              {t.list.apply}
            </button>
            <Link href="/admin/certificates" className={buttonClass.secondary}>
              {t.list.reset}
            </Link>
            <span className="ml-auto flex gap-2">
              <a href={exportHref("csv")} className={buttonClass.secondary}>
                {t.list.exportCsv}
              </a>
              <a href={exportHref("xlsx")} className={buttonClass.secondary}>
                {t.list.exportXlsx}
              </a>
            </span>
          </div>
        </form>
      </Card>

      <Card>
        {certificates.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="px-5 py-2 text-left text-xs text-slate-500">{t.list.count(total)}</caption>
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium">{t.number}</th>
                  <th className="px-5 py-2 font-medium">{t.company}</th>
                  <th className="px-5 py-2 font-medium">{t.status}</th>
                  <th className="px-5 py-2 font-medium whitespace-nowrap">{t.detail.issueDate}</th>
                  <th className="px-5 py-2 font-medium whitespace-nowrap">{t.validUntil}</th>
                  <th className="px-5 py-2 text-right font-medium">{t.products}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono whitespace-nowrap">
                      <Link href={`/admin/certificates/${c.id}`} className="font-medium text-brand-ink hover:underline">
                        {c.certificateNumber ?? t.draft}
                        {c.revision > 0 ? ` / Rev. ${c.revision}` : ""}
                      </Link>
                      {c.isLegacy ? <span className="ml-2 font-sans text-xs text-slate-500">{t.list.legacy}</span> : null}
                    </td>
                    <td className="px-5 py-2.5">{c.company.name}</td>
                    <td className="px-5 py-2.5">
                      <CertificateStatusBadge status={effectiveStatus(c.status, c.validUntil, today)} />
                    </td>
                    <td className="px-5 py-2.5 tabular-nums">{formatDate(c.issueDate)}</td>
                    <td className="px-5 py-2.5 tabular-nums">{formatDate(c.validUntil)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{c._count.products}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} href={(p) => listHref("/admin/certificates", { ...params, page: p })} />
      </Card>
    </>
  );
}
