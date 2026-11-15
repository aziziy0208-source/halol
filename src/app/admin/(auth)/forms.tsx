"use client";

import { useActionState, useEffect, useTransition } from "react";
import { Alert, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import { type AuthFormState, confirmTotpSetupAction, loginAction, logoutAction, verifyTwoFactorAction } from "./actions";

/**
 * Auth transitions use a full page load: the client router keeps visited pages
 * alive in hidden trees, and a 2FA secret or admin data must not survive a
 * sign-in or sign-out in the DOM.
 */
function useHardRedirect(target: string | undefined) {
  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);
}

type LoginLabels = { email: string; password: string; submit: string; submitting: string };

export function LoginForm({ labels, next, notice }: { labels: LoginLabels; next: string; notice?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  useHardRedirect(state.redirectTo);
  const busy = pending || Boolean(state.redirectTo);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : notice ? <Alert tone="info">{notice}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className={labelClass}>
          {labels.email}
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}

type CodeLabels = { code: string; submit: string; submitting: string };

/** 6-digit code form, used for both login verification and authenticator setup. */
export function CodeForm({ mode, labels, next }: { mode: "verify" | "setup"; labels: CodeLabels; next: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "verify" ? verifyTwoFactorAction : confirmTotpSetupAction,
    {},
  );
  useHardRedirect(state.redirectTo);
  const busy = pending || Boolean(state.redirectTo);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="code" className={labelClass}>
          {labels.code}
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
        />
      </div>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}

/** Ends the session, then reloads to the sign-in page so no admin data stays in memory. */
export function LogoutButton({ label, className }: { label: string; className: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await logoutAction();
          window.location.replace("/admin/login?signedOut=1");
        })
      }
    >
      {label}
    </button>
  );
}
