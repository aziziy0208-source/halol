import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, Card, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Approvals" };

/** Queue of certificates submitted for approval (oldest first). */
export default async function ApprovalsPage() {
  const user = await requireUser();
  if (!can(user.role, "certificate.edit")) return <Forbidden />;
  const t = (await adminT()).approvals;
  const pending = await prisma.certificate.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: [{ submittedAt: "asc" }],
    select: {
      id: true,
      certificateNumber: true,
      revision: true,
      scope: true,
      submittedAt: true,
      company: { select: { name: true, city: true, country: true } },
      createdBy: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });
  const decides = can(user.role, "certificate.issue");

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      {!decides ? <p className="mb-4 text-sm text-slate-600">{t.waitingOnly}</p> : null}
      {pending.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">{t.empty}</Card>
      ) : (
        <ul className="space-y-3">
          {pending.map((c) => (
            <li key={c.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {c.company.name}
                      {c.certificateNumber ? (
                        <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                          {c.certificateNumber} / Rev. {c.revision}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-600">{c.scope}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.products}: {c._count.products} · {t.submittedBy}: {c.createdBy.name} · {t.submittedAt}:{" "}
                      {formatDateTime(c.submittedAt)}
                    </p>
                  </div>
                  <Link href={`/admin/approvals/${c.id}`} className={decides ? buttonClass.primary : buttonClass.secondary}>
                    {t.review}
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
