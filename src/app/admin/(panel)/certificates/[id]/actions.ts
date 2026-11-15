"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  changeStatus,
  createRevision,
  deleteDraft,
  duplicateAsDraft,
  issueCertificate,
  returnToDraft,
  submitForApproval,
} from "@/certificates/workflow";
import { adminT } from "@/i18n/admin/server";
import { type ActionState, actionContext, errorState, text } from "@/lib/admin-actions";
import type { Permission } from "@/lib/auth/permissions";

const OPS = ["submit", "return", "issue", "delete", "suspend", "reactivate", "revoke", "revise", "duplicate"] as const;
type Op = (typeof OPS)[number];

/** Who may do what (spec §8): issuers prepare, admins decide. */
const REQUIRED: Record<Op, Permission> = {
  submit: "certificate.edit",
  delete: "certificate.edit",
  revise: "certificate.edit",
  duplicate: "certificate.edit",
  return: "certificate.issue",
  issue: "certificate.issue",
  suspend: "certificate.issue",
  reactivate: "certificate.issue",
  revoke: "certificate.issue",
};

/** Workflow buttons on the certificate page. The workflow layer re-validates the state in the database. */
export async function certificateWorkflowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT());
  const op = z.enum(OPS).safeParse(text(formData, "op"));
  const id = text(formData, "id");
  if (!op.success || !id) return { status: "error", message: t.common.unexpected };
  const access = await actionContext(REQUIRED[op.data]);
  if (!access.ok) return access.state;
  const { ctx } = access;
  const reason = text(formData, "reason");

  try {
    switch (op.data) {
      case "submit":
        await submitForApproval(id, ctx);
        break;
      case "return":
        await returnToDraft(id, reason, ctx);
        break;
      case "issue": {
        const result = await issueCertificate(id, ctx);
        refresh();
        return { status: "success", message: t.workflow.issued(result.certificateNumber) };
      }
      case "delete":
        await deleteDraft(id, ctx);
        return { status: "success", message: t.workflow.done, redirectTo: "/admin/certificates" };
      case "suspend":
      case "reactivate":
      case "revoke":
        await changeStatus(id, op.data, reason, ctx);
        break;
      case "revise":
        return { status: "success", message: t.workflow.done, redirectTo: `/admin/certificates/${await createRevision(id, ctx)}/edit` };
      case "duplicate":
        return { status: "success", message: t.workflow.done, redirectTo: `/admin/certificates/${await duplicateAsDraft(id, ctx)}/edit` };
    }
  } catch (error) {
    return errorState(error);
  }
  refresh();
  return { status: "success", message: t.workflow.done };
}
