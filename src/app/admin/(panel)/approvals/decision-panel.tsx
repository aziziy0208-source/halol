"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionMessage, useActionRedirect } from "@/components/admin/action-feedback";
import { Alert, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import { useAdminMessages } from "@/i18n/admin/client";
import type { ActionState } from "@/lib/admin-actions";
import { approveAction, returnAction } from "./actions";

const IDLE: ActionState = { status: "idle" };

/** Approve (issue) or return a submitted certificate. */
export function DecisionPanel({
  id,
  ready,
  fourEyesBlocked,
  canChangeSettings,
}: {
  id: string;
  /** All data needed for issuing is present. */
  ready: boolean;
  fourEyesBlocked: boolean;
  canChangeSettings: boolean;
}) {
  const messages = useAdminMessages();
  const t = messages.approvals;
  const [approveState, approve, approving] = useActionState(approveAction, IDLE);
  const [returnState, sendBack, returning] = useActionState(returnAction, IDLE);
  useActionRedirect(approveState);
  useActionRedirect(returnState);
  const busy = approving || returning;

  return (
    <div className="space-y-5 p-5">
      <ActionMessage state={approveState} />
      <ActionMessage state={returnState} />
      {approveState.status === "success" || returnState.status === "success" ? (
        <p role="status" className="text-sm text-slate-500">
          {messages.common.redirecting}
        </p>
      ) : null}

      {fourEyesBlocked ? (
        <Alert tone="info">
          <p>{t.fourEyes}</p>
          {canChangeSettings ? (
            <p className="mt-1">
              {t.fourEyesSettings}{" "}
              <Link href="/admin/settings" className="font-medium underline">
                {t.openSettings}
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : (
        <form action={approve}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={busy || !ready}
            className={`${buttonClass.primary} w-full py-3 text-base`}
            onClick={(e) => {
              if (!window.confirm(t.confirmApprove)) e.preventDefault();
            }}
          >
            {approving ? t.approving : t.approve}
          </button>
        </form>
      )}

      <form action={sendBack} className="space-y-2 border-t border-slate-200 pt-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm font-semibold text-slate-800">{t.returnTitle}</p>
        <p className="text-xs text-slate-500">{t.returnHint}</p>
        <label htmlFor="return-reason" className={labelClass}>
          {t.reason}
        </label>
        <textarea id="return-reason" name="reason" required minLength={3} maxLength={500} rows={3} className={inputClass} />
        <button type="submit" disabled={busy} className={buttonClass.secondary}>
          {t.returnButton}
        </button>
      </form>
    </div>
  );
}
