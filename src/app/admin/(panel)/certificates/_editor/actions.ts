"use server";

import { draftSchema } from "@/certificates/draft-schema";
import { findCertificate, imageDataUri, verificationFor } from "@/certificates/load";
import { issueCertificate, saveDraft, submitForApproval, WorkflowError } from "@/certificates/workflow";
import { adminT } from "@/i18n/admin/server";
import { actionContext, workflowErrorText } from "@/lib/admin-actions";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import type { EditorIntent, EditorResult, SavedDraft } from "./types";

/**
 * Saves the editor content as a draft, then optionally submits or issues it.
 * Permissions are checked here for every step (certificate.edit; company.create
 * for a new company; certificate.issue for issuing); business rules live in the workflow.
 */
export async function saveEditorAction(input: unknown, intent: EditorIntent): Promise<EditorResult> {
  const t = (await adminT());
  const access = await actionContext("certificate.edit");
  if (!access.ok) return { ok: false, message: access.state.message ?? t.forbidden.text };
  const { user, ctx } = access;

  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: t.editor.invalid,
      issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(" › ") || "input"}: ${i.message}`),
    };
  }
  if (parsed.data.company.mode === "new" && !can(user.role, "company.create")) return { ok: false, message: t.forbidden.text };
  if (intent === "issue" && !can(user.role, "certificate.issue")) return { ok: false, message: t.forbidden.text };

  let id: string;
  try {
    id = await saveDraft(parsed.data, ctx);
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, message: workflowErrorText(t, error) };
    console.error(error);
    return { ok: false, message: t.common.unexpected };
  }

  // The draft is saved from here on: failures below still hand its id back,
  // so the editor keeps editing this draft instead of creating another.
  const saved = async (): Promise<SavedDraft | undefined> => {
    const cert = await findCertificate(id);
    return cert ? { companyId: cert.companyId, verification: await verificationFor(cert.publicToken) } : undefined;
  };
  try {
    if (intent === "submit") {
      await submitForApproval(id, ctx);
      return { ok: true, id, message: t.workflow.done, redirectTo: `/admin/certificates/${id}` };
    }
    if (intent === "issue") {
      const result = await issueCertificate(id, ctx);
      return { ok: true, id, message: t.workflow.issued(result.certificateNumber), redirectTo: `/admin/certificates/${id}` };
    }
    return { ok: true, id, message: t.editor.saved, saved: await saved() };
  } catch (error) {
    if (!(error instanceof WorkflowError)) console.error(error);
    return {
      ok: false,
      id,
      message: error instanceof WorkflowError ? `${t.editor.saved} ${workflowErrorText(t, error)}` : t.common.unexpected,
      saved: await saved(),
    };
  }
}

/** The company's logo for the live preview (data: URI; logos are private files). */
export async function companyLogoAction(companyId: unknown): Promise<string | null> {
  const access = await actionContext("certificate.edit");
  if (!access.ok || typeof companyId !== "string" || !companyId) return null;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { logoImageKey: true } });
  return imageDataUri(company?.logoImageKey);
}
