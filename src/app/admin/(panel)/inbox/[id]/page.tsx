import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, buttonClass, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import type { StoredAttachment } from "@/lib/inbox/sync";
import { deleteInboundAction, setInboundReadAction } from "../actions";
import { DeleteEmailButton } from "./delete-button";

export const metadata: Metadata = { title: "E-mail" };

/**
 * Untrusted HTML from the internet: rendered in an iframe without scripts, forms,
 * same-origin access or any remote content (no tracking pixels — DSGVO); links open
 * in a new tab.
 */
function sandboxedDocument(html: string): string {
  const csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;margin:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default async function InboundEmailPage({ params, searchParams }: PageProps<"/admin/inbox/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "message.view")) return <Forbidden />;
  const { id } = await params;
  const view = (await searchParams).view === "text" ? "text" : "html";
  const email = await prisma.inboundEmail.findUnique({ where: { id } });
  if (!email) notFound();
  if (!email.isRead) await prisma.inboundEmail.updateMany({ where: { id, isRead: false }, data: { isRead: true } });

  const t = (await adminT()).inbox;
  const attachments = (email.attachments as unknown as StoredAttachment[]).filter((a) => !a.inline);
  const showHtml = view === "html" && Boolean(email.html);
  const suspicious = [email.spf, email.dkim, email.dmarc].includes("fail");
  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  const facts: [string, string][] = [
    [t.from, from],
    [t.to, email.to.join(", ")],
    ...(email.cc.length ? [[t.cc, email.cc.join(", ")] as [string, string]] : []),
    [t.date, formatDateTime(email.receivedAt)],
  ];

  return (
    <>
      <Link href="/admin/inbox" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.back}
      </Link>
      <PageHeader title={email.subject || t.noSubject}>
        <div className="flex flex-wrap gap-2">
          <a href={`https://resend.com/inboxes/${encodeURIComponent(serverEnv().CONTACT_TO_EMAIL)}`} target="_blank" rel="noopener noreferrer" className={buttonClass.primary}>
            {t.reply}
          </a>
          <form action={setInboundReadAction.bind(null, email.id, false)}>
            <button type="submit" className={buttonClass.secondary}>
              {t.markUnread}
            </button>
          </form>
          <DeleteEmailButton action={deleteInboundAction.bind(null, email.id)} label={t.delete} confirmText={t.deleteConfirm} />
        </div>
      </PageHeader>

      {suspicious ? (
        <div className="mb-4">
          <Alert tone="error">{t.suspicious}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title={t.message}>
            {email.html && email.text ? (
              <div className="flex gap-3 text-sm">
                <Link href={`/admin/inbox/${email.id}`} className={view === "html" ? "font-semibold text-slate-900" : buttonClass.link}>
                  {t.formatted}
                </Link>
                <Link href={`/admin/inbox/${email.id}?view=text`} className={view === "text" ? "font-semibold text-slate-900" : buttonClass.link}>
                  {t.plainText}
                </Link>
              </div>
            ) : null}
          </CardHeader>
          {showHtml ? (
            <div className="p-3">
              <iframe
                title={t.message}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={sandboxedDocument(email.html!)}
                className="h-[70vh] w-full rounded border border-slate-200 bg-white"
              />
              <p className="mt-2 text-xs text-slate-500">{t.remoteBlocked}</p>
            </div>
          ) : (
            <pre className="px-5 py-4 font-sans text-sm whitespace-pre-wrap text-slate-800">{email.text || t.noBody}</pre>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title={`${t.attachments} (${attachments.length})`} />
            {attachments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">{t.noAttachments}</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    {a.storageKey ? (
                      <a href={`/admin/inbox/${email.id}/attachments/${a.id}`} className={`${buttonClass.link} min-w-0 break-all`}>
                        {a.filename}
                      </a>
                    ) : (
                      <span className="min-w-0 break-all text-slate-600">
                        {a.filename} <span className="text-xs text-slate-500">({t.notStored})</span>
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{sizeLabel(a.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
