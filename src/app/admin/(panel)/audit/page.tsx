import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Audit log" };

const LIMIT = 200;

export default async function AuditPage() {
  const user = await requireUser();
  if (!can(user.role, "audit.view")) return <Forbidden />;
  const t = (await adminT()).audit;
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <Card>
        {entries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="px-5 py-2 text-left text-xs text-slate-500">{t.showing(entries.length)}</caption>
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium whitespace-nowrap">{t.time}</th>
                  <th className="px-5 py-2 font-medium">{t.user}</th>
                  <th className="px-5 py-2 font-medium">{t.action}</th>
                  <th className="px-5 py-2 font-medium">{t.entity}</th>
                  <th className="px-5 py-2 font-medium">{t.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-2 whitespace-nowrap tabular-nums">{formatDateTime(e.createdAt)}</td>
                    <td className="px-5 py-2">{e.user ? e.user.name : <span className="text-slate-400">{t.system}</span>}</td>
                    <td className="px-5 py-2 font-mono text-xs">{e.action}</td>
                    <td className="px-5 py-2 text-xs">
                      {e.entityType}
                      <span className="block font-mono text-slate-400">{e.entityId}</span>
                    </td>
                    <td className="max-w-md px-5 py-2">
                      {e.before || e.after ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-brand-ink">JSON</summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                            {JSON.stringify({ before: e.before ?? undefined, after: e.after ?? undefined }, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
