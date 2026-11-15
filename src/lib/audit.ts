import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type AuditEntry = {
  /** Acting user; null for anonymous or system actions (failed logins, CLI, seed). */
  userId: string | null;
  /** Dotted verb, e.g. "auth.login.success", "user.role.change", "message.read". */
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipHash?: string | null;
};

type Db = Pick<typeof prisma, "auditLog">;

/** Appends to the audit trail (append-only; the DB rejects UPDATE/DELETE). */
export async function audit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      ipHash: entry.ipHash ?? null,
    },
  });
}
