"use client";

import { useActionState, useEffect } from "react";
import { Alert, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import { changePasswordAction, type PasswordFormState } from "./actions";

type Labels = { current: string; next: string; confirm: string; rules: string; submit: string };

export function PasswordForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState(changePasswordAction, { status: "idle" } as PasswordFormState);
  useEffect(() => {
    if (state.redirectTo) window.location.replace(state.redirectTo);
  }, [state.redirectTo]);
  return (
    <form action={action} className="space-y-4 p-5">
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}
      <div>
        <label htmlFor="pw-current" className={labelClass}>
          {labels.current}
        </label>
        <input id="pw-current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pw-next" className={labelClass}>
            {labels.next}
          </label>
          <input id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pw-confirm" className={labelClass}>
            {labels.confirm}
          </label>
          <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={200} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-slate-500">{labels.rules}</p>
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {labels.submit}
      </button>
    </form>
  );
}
