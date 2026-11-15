"use server";

import { refresh } from "next/cache";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/current-user";
import { requestContext } from "@/lib/auth/login";
import { prisma } from "@/lib/db";

export async function setMessageReadAction(messageId: string, isRead: boolean): Promise<void> {
  const auth = await authorize("message.view");
  if (!auth.ok) return;
  const updated = await prisma.contactMessage.updateMany({ where: { id: messageId, isRead: !isRead }, data: { isRead } });
  if (updated.count > 0) {
    const ctx = await requestContext();
    await audit({
      userId: auth.user.id,
      action: isRead ? "message.read" : "message.unread",
      entityType: "ContactMessage",
      entityId: messageId,
      ipHash: ctx.ipHash,
    });
  }
  refresh();
}
