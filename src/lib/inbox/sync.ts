import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { downloadAttachment, listReceived, listReceivedAttachments, retrieveReceived } from "./resend";

/** Attachments up to this size are copied to private storage; larger ones keep only their metadata. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Very large HTML bodies (inline images as data URIs) are dropped; the plain text stays. */
const MAX_HTML_CHARS = 3_000_000;
const MAX_PAGES = 5;

export type StoredAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
  storageKey: string | null;
};

/** "Erika Muster <erika@example.com>" → name + address. */
export function parseMailbox(value: string): { name: string | null; address: string } {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || null, address: match[2].trim() };
  return { name: null, address: value.trim() };
}

function safeFilename(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(-80);
  return cleaned || "attachment";
}

async function importEmail(providerId: string): Promise<boolean> {
  const email = await retrieveReceived(providerId);
  const attachments: StoredAttachment[] = [];
  if (email.attachments?.length) {
    const list = await listReceivedAttachments(providerId);
    for (const a of list.data) {
      const inline = a.content_disposition === "inline" && Boolean(a.content_id);
      let storageKey: string | null = null;
      // Inline images are already embedded in the HTML (data URIs); real attachments are kept.
      if (!inline && a.size <= MAX_ATTACHMENT_BYTES) {
        const body = await downloadAttachment(a.download_url, MAX_ATTACHMENT_BYTES);
        if (body) {
          storageKey = `inbound/${providerId}/${a.id}-${safeFilename(a.filename ?? "attachment")}`;
          await storage().put(storageKey, body, a.content_type || "application/octet-stream");
        }
      }
      attachments.push({
        id: a.id,
        filename: a.filename || "attachment",
        contentType: a.content_type || "application/octet-stream",
        size: a.size,
        inline,
        storageKey,
      });
    }
  }
  const from = parseMailbox(email.from);
  const html = email.html && email.html.length <= MAX_HTML_CHARS ? email.html : null;
  const result = await prisma.inboundEmail.createMany({
    data: {
      providerId,
      messageId: email.message_id,
      fromAddress: from.address,
      fromName: from.name,
      to: email.to ?? [],
      cc: email.cc ?? [],
      replyTo: email.reply_to ?? [],
      subject: email.subject?.trim() || "",
      text: email.text,
      html,
      attachments: attachments as unknown as Prisma.InputJsonValue,
      spf: email.authentication?.spf ?? null,
      dkim: email.authentication?.dkim ?? null,
      dmarc: email.authentication?.dmarc ?? null,
      receivedAt: new Date(email.created_at),
    },
    skipDuplicates: true, // a parallel sync may have stored it already
  });
  return result.count === 1;
}

/**
 * Copies e-mails received since the last sync. The provider lists newest first:
 * collect unknown ids until a page reaches already-imported mail, then import them
 * oldest first — an interrupted sync never leaves a gap behind newer imported mail.
 */
export async function syncInbox(actorId: string | null): Promise<{ imported: number }> {
  const pending: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const list = await listReceived(after);
    if (list.data.length === 0) break;
    const ids = list.data.map((d) => d.id);
    const known = new Set(
      (await prisma.inboundEmail.findMany({ where: { providerId: { in: ids } }, select: { providerId: true } })).map(
        (r) => r.providerId,
      ),
    );
    pending.push(...ids.filter((id) => !known.has(id)));
    if (!list.has_more || known.size > 0) break;
    after = ids[ids.length - 1];
  }
  let imported = 0;
  for (const id of pending.reverse()) {
    if (await importEmail(id)) imported++;
  }
  if (imported > 0) {
    await audit({ userId: actorId, action: "inbox.sync", entityType: "InboundEmail", entityId: "resend", after: { imported } });
  }
  return { imported };
}
