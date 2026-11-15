import type { Metadata } from "next";
import { Badge, buttonClass, Card, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { setMessageReadAction } from "./actions";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser();
  if (!can(user.role, "message.view")) return <Forbidden />;
  const t = (await adminT()).messages;
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      {messages.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">{t.empty}</Card>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id}>
              <Card className={m.isRead ? "" : "border-l-4 border-l-brand"}>
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {m.name} {!m.isRead ? <Badge tone="blue">{t.unread}</Badge> : null}
                    </p>
                    <a href={`mailto:${m.email}`} className={`${buttonClass.link} break-all`}>
                      {m.email}
                    </a>
                    <p className="text-xs text-slate-500">
                      {t.received}: {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                  <form action={setMessageReadAction.bind(null, m.id, !m.isRead)}>
                    <button type="submit" className={buttonClass.secondary}>
                      {m.isRead ? t.markUnread : t.markRead}
                    </button>
                  </form>
                </div>
                <p className="px-5 pt-3 pb-4 text-sm whitespace-pre-wrap text-slate-700">{m.message}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
