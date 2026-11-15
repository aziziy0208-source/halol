"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionMessage, useActionRedirect } from "@/components/admin/action-feedback";
import { Alert, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import { useAdminMessages } from "@/i18n/admin/client";
import type { ActionState } from "@/lib/admin-actions";
import type { EffectiveStatus } from "@/lib/certificates/status";
import { certificateWorkflowAction } from "./actions";

const IDLE: ActionState = { status: "idle" };

type ReasonOp = "return" | "suspend" | "reactivate" | "revoke";

export type WorkflowProps = {
  id: string;
  status: EffectiveStatus;
  canEdit: boolean;
  canIssue: boolean;
  /** Four-eyes rule blocks the current user from issuing this draft. */
  fourEyesBlocked: boolean;
  /** Drafts holding a reserved original number cannot be deleted. */
  deletable: boolean;
};

export function WorkflowActions({ id, status, canEdit, canIssue, fourEyesBlocked, deletable }: WorkflowProps) {
  const messages = useAdminMessages();
  const t = messages.workflow;
  const [reasonFor, setReasonFor] = useState<ReasonOp | null>(null);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await certificateWorkflowAction(prev, formData);
    if (result.status === "success") setReasonFor(null);
    return result;
  }, IDLE);
  useActionRedirect(state);

  const draft = status === "DRAFT";
  const pendingApproval = status === "PENDING_APPROVAL";
  const unissued = draft || pendingApproval;
  // EXPIRED is ACTIVE in the database: it can still be suspended, revoked or revised.
  const live = status === "ACTIVE" || status === "EXPIRED";

  const button = (op: string, label: string, tone: keyof typeof buttonClass = "secondary", confirmText?: string) => (
    <button
      key={op}
      type="submit"
      name="op"
      value={op}
      disabled={pending}
      className={buttonClass[tone]}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {op === "issue" && pending ? t.issuing : label}
    </button>
  );
  const reasonButton = (op: ReasonOp, label: string, tone: keyof typeof buttonClass = "secondary") => (
    <button key={op} type="button" disabled={pending} className={buttonClass[tone]} onClick={() => setReasonFor(op)}>
      {label}
    </button>
  );

  const buttons = [
    unissued && canEdit ? (
      <Link key="edit" href={`/admin/certificates/${id}/edit`} className={buttonClass.secondary}>
        {t.edit}
      </Link>
    ) : null,
    draft && canEdit ? button("submit", t.submit) : null,
    unissued && canIssue && !fourEyesBlocked ? button("issue", t.issue, "primary", t.confirmIssue) : null,
    pendingApproval && canIssue ? (
      <Link key="approval" href={`/admin/approvals/${id}`} className={buttonClass.primary}>
        {messages.approvals.openWindow}
      </Link>
    ) : null,
    pendingApproval && canIssue ? reasonButton("return", t.returnToDraft) : null,
    unissued && canEdit && deletable ? button("delete", t.deleteDraft, "danger", t.confirmDelete) : null,
    live && canIssue ? reasonButton("suspend", t.suspend) : null,
    status === "SUSPENDED" && canIssue ? reasonButton("reactivate", t.reactivate) : null,
    (live || status === "SUSPENDED") && canIssue ? reasonButton("revoke", t.revoke, "danger") : null,
    (live || status === "SUSPENDED") && canEdit ? button("revise", t.revise) : null,
    !unissued && canEdit ? button("duplicate", t.duplicate) : null,
  ].filter(Boolean);

  const labels: Record<ReasonOp, string> = {
    return: t.returnToDraft,
    suspend: t.suspend,
    reactivate: t.reactivate,
    revoke: t.revoke,
  };

  return (
    <div className="space-y-3 p-5">
      <ActionMessage state={state} />
      {unissued && canIssue && fourEyesBlocked ? <Alert tone="info">{t.fourEyes}</Alert> : null}
      {pendingApproval && !canIssue ? <p className="text-sm text-slate-600">{t.waitingForAdmin}</p> : null}
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        {reasonFor ? (
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label htmlFor="workflow-reason" className={labelClass}>
              {labels[reasonFor]} — {t.reason}
            </label>
            <textarea
              id="workflow-reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              className={inputClass}
              autoFocus
            />
            <div className="flex gap-2">
              {button(reasonFor, t.confirm, reasonFor === "revoke" ? "danger" : "primary", reasonFor === "revoke" ? t.confirmRevoke : undefined)}
              <button type="button" className={buttonClass.secondary} onClick={() => setReasonFor(null)}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : buttons.length ? (
          <div className="flex flex-wrap gap-2">{buttons}</div>
        ) : (
          <p className="text-sm text-slate-500">{t.noActions}</p>
        )}
      </form>
    </div>
  );
}
