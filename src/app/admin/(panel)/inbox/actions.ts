"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/current-user";
import { requestContext } from "@/lib/auth/login";
import { prisma } from "@/lib/db";
import { inboxConfigured } from "@/lib/inbox/resend";
import { syncInbox, type StoredAttachment } from "@/lib/inbox/sync";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { storage } from "@/lib/storage";

export type SyncState = { status: "ok"; imported: number } | { status: "notConfigured" | "busy" | "error" | "forbidden" };

/** Loads new mail from the provider (called when the mailbox opens, and by the refresh button). */
export async function syncInboxAction(): Promise<SyncState> {
  const auth = await authorize("message.view");
  if (!auth.ok) return { status: "forbidden" };
  if (!inboxConfigured()) return { status: "notConfigured" };
  // Shared across admins: protects the provider's rate limit (10 requests/s per team).
  if (!(await consumeRateLimit("inbox:sync", 6, 60)).allowed) return { status: "busy" };
  try {
    const { imported } = await syncInbox(auth.user.id);
    if (imported > 0) refresh();
    return { status: "ok", imported };
  } catch (error) {
    console.error("[inbox] sync failed", error);
    return { status: "error" };
  }
}

export async function setInboundReadAction(id: string, isRead: boolean): Promise<void> {
  const auth = await authorize("message.view");
  if (!auth.ok) return;
  await prisma.inboundEmail.updateMany({ where: { id }, data: { isRead } });
  if (!isRead) redirect("/admin/inbox");
  refresh();
}

export async function deleteInboundAction(id: string): Promise<void> {
  const auth = await authorize("message.view");
  if (!auth.ok) return;
  const email = await prisma.inboundEmail.findUnique({ where: { id } });
  if (!email) redirect("/admin/inbox");
  for (const a of email.attachments as unknown as StoredAttachment[]) {
    if (a.storageKey) await storage().delete(a.storageKey);
  }
  await prisma.inboundEmail.delete({ where: { id } });
  const ctx = await requestContext();
  await audit({
    userId: auth.user.id,
    action: "inbox.delete",
    entityType: "InboundEmail",
    entityId: id,
    before: { from: email.fromAddress, subject: email.subject, receivedAt: email.receivedAt.toISOString() },
    ipHash: ctx.ipHash,
  });
  redirect("/admin/inbox");
}
