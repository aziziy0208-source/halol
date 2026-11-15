"use server";

import { issueCertificate, returnToDraft } from "@/certificates/workflow";
import { adminT } from "@/i18n/admin/server";
import { type ActionState, actionContext, errorState, text } from "@/lib/admin-actions";

/**
 * Decisions in the approval window. Permission certificate.issue (admins) is checked
 * here; the workflow re-checks state, completeness and the four-eyes rule.
 */
export async function approveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).approvals;
  const access = await actionContext("certificate.issue");
  if (!access.ok) return access.state;
  const id = text(formData, "id");
  try {
    const result = await issueCertificate(id, access.ctx);
    return { status: "success", message: t.approved(result.certificateNumber), redirectTo: `/admin/certificates/${id}` };
  } catch (error) {
    return errorState(error);
  }
}

export async function returnAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).approvals;
  const access = await actionContext("certificate.issue");
  if (!access.ok) return access.state;
  try {
    await returnToDraft(text(formData, "id"), text(formData, "reason"), access.ctx);
    return { status: "success", message: t.returned, redirectTo: "/admin/approvals" };
  } catch (error) {
    return errorState(error);
  }
}
