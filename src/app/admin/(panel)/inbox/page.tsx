import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import type { StoredAttachment } from "@/lib/inbox/sync";
import { InboxSync } from "./inbox-sync";

export const metadata: Metadata = { title: "Mailbox" };

const PAGE_SIZE = 100;

export default async function InboxPage() {
  const user = await requireUser();
  if (!can(user.role, "message.view")) return <Forbidden />;
  const t = (await adminT()).inbox;
  const emails = await prisma.inboundEmail.findMany({
    orderBy: { receivedAt: "desc" },
    take: PAGE_SIZE,
    select: { id: true, fromAddress: true, fromName: true, subject: true, text: true, isRead: true, receivedAt: true, attachments: true },
  });

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle(serverEnv().CONTACT_TO_EMAIL)}>
        <InboxSync />
      </PageHeader>
      {emails.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">{t.empty}</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {emails.map((e) => {
              const files = (e.attachments as unknown as StoredAttachment[]).filter((a) => !a.inline).length;
              return (
                <li key={e.id}>
                  <Link
                    href={`/admin/inbox/${e.id}`}
                    className={`flex flex-col gap-0.5 px-5 py-3 hover:bg-slate-50 sm:flex-row sm:items-baseline sm:gap-4 ${e.isRead ? "" : "border-l-4 border-l-brand"}`}
                  >
                    <span className={`w-56 shrink-0 truncate text-sm ${e.isRead ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                      {e.fromName ?? e.fromAddress}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className={e.isRead ? "text-slate-800" : "font-semibold text-slate-900"}>{e.subject || t.noSubject}</span>
                      {e.text ? <span className="text-slate-500"> — {e.text.replace(/\s+/g, " ").slice(0, 140)}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500 tabular-nums">
                      {!e.isRead ? <Badge tone="blue">{t.unread}</Badge> : null}
                      {files ? <span aria-label={t.attachments}>📎 {files}</span> : null}
                      {formatDateTime(e.receivedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
