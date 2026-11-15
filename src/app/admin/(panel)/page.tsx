import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { addDays, businessToday, formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const t = (await adminT());
  const today = businessToday();
  const in30Days = addDays(today, 30);
  const showMessages = can(user.role, "message.view");

  const [active, expiringSoon, expired, suspended, revoked, inProgress, unread, scans, scans30, awaiting] = await Promise.all([
    prisma.certificate.count({ where: { status: "ACTIVE", validUntil: { gte: today } } }),
    prisma.certificate.count({ where: { status: "ACTIVE", validUntil: { gte: today, lte: in30Days } } }),
    prisma.certificate.count({ where: { status: "ACTIVE", validUntil: { lt: today } } }),
    prisma.certificate.count({ where: { status: "SUSPENDED" } }),
    prisma.certificate.count({ where: { status: "REVOKED" } }),
    prisma.certificate.count({ where: { status: { in: ["DRAFT", "PENDING_APPROVAL"] } } }),
    showMessages ? prisma.contactMessage.count({ where: { isRead: false } }) : Promise.resolve(0),
    prisma.scanLog.findMany({
      take: 8,
      orderBy: { scannedAt: "desc" },
      select: { id: true, scannedAt: true, country: true, channel: true, certificate: { select: { id: true, certificateNumber: true, revision: true } } },
    }),
    prisma.scanLog.count({ where: { scannedAt: { gte: addDays(new Date(), -30) } } }),
    prisma.certificate.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);

  const stats: { label: string; value: number; tone: string; href?: string }[] = [
    ...(can(user.role, "certificate.edit")
      ? [{ label: t.approvals.dashboardTile, value: awaiting, tone: awaiting ? "text-amber-700" : "text-slate-600", href: "/admin/approvals" }]
      : []),
    { label: t.dashboard.active, value: active, tone: "text-emerald-700" },
    { label: t.dashboard.expiringSoon, value: expiringSoon, tone: "text-amber-700" },
    { label: t.dashboard.expired, value: expired, tone: "text-slate-600" },
    { label: t.dashboard.suspended, value: suspended, tone: "text-orange-700" },
    { label: t.dashboard.revoked, value: revoked, tone: "text-red-700" },
    { label: t.dashboard.inProgress, value: inProgress, tone: "text-sky-700" },
    { label: t.dashboard.scans30, value: scans30, tone: "text-slate-800" },
  ];
  if (showMessages) stats.push({ label: t.dashboard.unreadMessages, value: unread, tone: "text-brand-ink", href: "/admin/messages" });

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.greeting(user.name)} />
      <ul className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
            </>
          );
          return (
            <li key={s.label}>
              {s.href ? (
                <Link href={s.href} className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand">
                  {body}
                </Link>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <Card>
        <CardHeader title={t.dashboard.recentScans} />
        {scans.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t.dashboard.noScans}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium">{t.dashboard.certificate}</th>
                  <th className="px-5 py-2 font-medium">{t.dashboard.scannedAt}</th>
                  <th className="px-5 py-2 font-medium">{t.dashboard.channel}</th>
                  <th className="px-5 py-2 font-medium">{t.dashboard.country}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="px-5 py-2 font-mono">
                      <Link href={`/admin/certificates/${scan.certificate.id}`} className="text-brand-ink hover:underline">
                        {scan.certificate.certificateNumber ?? "—"}
                        {scan.certificate.revision > 0 ? ` / Rev. ${scan.certificate.revision}` : ""}
                      </Link>
                    </td>
                    <td className="px-5 py-2">{formatDateTime(scan.scannedAt)}</td>
                    <td className="px-5 py-2">{t.dashboard.channels[scan.channel]}</td>
                    <td className="px-5 py-2">{scan.country ?? "—"}</td>
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
