import type { Metadata } from "next";
import Link from "next/link";
import { listHref, PAGE_SIZE, pageParam, Pagination, param } from "@/components/admin/pagination";
import { buttonClass, Card, inputBase, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import type { Prisma } from "@/generated/prisma/client";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { businessToday } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: PageProps<"/admin/companies">) {
  const user = await requireUser();
  if (!can(user.role, "company.view")) return <Forbidden />;
  const t = (await adminT()).companies;
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 100);
  const page = pageParam(sp.page);

  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const where: Prisma.CompanyWhereInput = q
    ? { OR: [{ name: contains(q) }, { city: contains(q) }, { postalCode: contains(q) }, { registrationNo: contains(q) }] }
    : {};
  const today = businessToday();
  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        postalCode: true,
        city: true,
        country: true,
        _count: {
          select: {
            certificates: { where: { status: { notIn: ["DRAFT", "PENDING_APPROVAL"] } } },
          },
        },
        certificates: { where: { status: "ACTIVE", validUntil: { gte: today } }, select: { id: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle}>
        {can(user.role, "company.create") ? (
          <Link href="/admin/companies/new" className={buttonClass.primary}>
            {t.create}
          </Link>
        ) : null}
      </PageHeader>

      <form role="search" className="mb-4 flex flex-wrap items-end gap-2">
        <label htmlFor="company-q" className="sr-only">
          {t.search}
        </label>
        <input
          id="company-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.searchPlaceholder}
          className={`${inputBase} w-full max-w-md`}
        />
        <button type="submit" className={buttonClass.secondary}>
          {t.search}
        </button>
      </form>

      <Card>
        {companies.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="px-5 py-2 text-left text-xs text-slate-500">{t.count(total)}</caption>
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium">{t.name}</th>
                  <th className="px-5 py-2 font-medium">{t.location}</th>
                  <th className="px-5 py-2 text-right font-medium">{t.certificates}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/companies/${c.id}`} className="font-medium text-brand-ink hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {[c.postalCode, c.city].filter(Boolean).join(" ")}
                      {c.city || c.postalCode ? ", " : ""}
                      {c.country}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {c._count.certificates}
                      {c.certificates.length ? (
                        <span className="ml-2 text-xs text-emerald-700">
                          ({c.certificates.length} {t.valid})
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} href={(p) => listHref("/admin/companies", { q, page: p })} />
      </Card>
    </>
  );
}
