import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { fileResponse } from "@/lib/http";
import type { StoredAttachment } from "@/lib/inbox/sync";
import { storage } from "@/lib/storage";

/** Attachment of a received e-mail — always as a download (never rendered inline: untrusted content). */
export async function GET(_request: Request, { params }: RouteContext<"/admin/inbox/[id]/attachments/[attachmentId]">) {
  const user = await requireUser();
  if (!can(user.role, "message.view")) return new Response("Forbidden", { status: 403 });
  const { id, attachmentId } = await params;
  const email = await prisma.inboundEmail.findUnique({ where: { id }, select: { attachments: true } });
  const attachment = (email?.attachments as unknown as StoredAttachment[] | undefined)?.find((a) => a.id === attachmentId);
  if (!attachment?.storageKey) return new Response("Not found", { status: 404 });
  const body = await storage().get(attachment.storageKey);
  if (!body) return new Response("Not found", { status: 404 });
  return fileResponse(body, "application/octet-stream", attachment.filename);
}
