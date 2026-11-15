import "server-only";
import { WorkflowError, type WorkflowContext } from "@/certificates/workflow";
import type { AdminMessages } from "@/i18n/admin";
import { adminT } from "@/i18n/admin/server";
import { type AdminUser, authorize } from "@/lib/auth/current-user";
import { requestContext } from "@/lib/auth/login";
import type { Permission } from "@/lib/auth/permissions";

/** Result shape shared by the admin forms (useActionState). */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Full page load target after success (keeps no stale data in hidden router trees). */
  redirectTo?: string;
};

export const IDLE: ActionState = { status: "idle" };

type Allowed = { ok: true; user: AdminUser; ctx: WorkflowContext };
type Denied = { ok: false; state: ActionState };

/** Every admin server action starts here: session + role check, audit context. */
export async function actionContext(permission: Permission): Promise<Allowed | Denied> {
  const auth = await authorize(permission);
  if (!auth.ok) return { ok: false, state: { status: "error", message: (await adminT()).forbidden.text } };
  const { ipHash } = await requestContext();
  return { ok: true, user: auth.user, ctx: { actorId: auth.user.id, ipHash } };
}

/** A workflow rule violation in the admin's language. */
export function workflowErrorText(t: AdminMessages, error: WorkflowError): string {
  const texts = t.workflowErrors;
  switch (error.code) {
    case "incomplete":
      return texts.incomplete((error.detail.problems ?? []).map((p) => t.problems[p]).join(" "));
    case "statusNotAllowed": {
      const status = error.detail.status ?? "";
      return texts.statusNotAllowed(t.certificates.statuses[status as keyof typeof t.certificates.statuses] ?? status);
    }
    default:
      return texts[error.code];
  }
}

/** Turns an exception into a message for the user; unexpected errors are logged, not shown. */
export async function errorState(error: unknown): Promise<ActionState> {
  const t = await adminT();
  if (error instanceof WorkflowError) return { status: "error", message: workflowErrorText(t, error) };
  console.error(error);
  return { status: "error", message: t.common.unexpected };
}

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
