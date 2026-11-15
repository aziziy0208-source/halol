"use client";

import { useActionState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { Alert, buttonClass, inputBase, inputClass, labelClass } from "@/components/admin/ui";
import { createUserAction, manageUserAction, type UserActionState } from "./actions";

type RoleOption = { value: Role; label: string; description: string };

function TempPassword({ state, hint }: { state: UserActionState; hint: string }) {
  if (!state.tempPassword) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="rounded bg-slate-900 px-3 py-2 font-mono text-sm tracking-wide text-white select-all">{state.tempPassword}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

type CreateLabels = { name: string; email: string; role: string; password: string; passwordHint: string; submit: string; hint: string };

export function CreateUserForm({ roles, labels }: { roles: RoleOption[]; labels: CreateLabels }) {
  // The server action is passed directly (works without JavaScript too). After an error it
  // returns the entries, so the reset form shows them again (the password is never echoed).
  const [state, action, pending] = useActionState(createUserAction, { status: "idle" } as UserActionState);
  const v = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} className="space-y-4 p-5">
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>
          {state.message}
          <TempPassword state={state} hint={labels.hint} />
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="new-name" className={labelClass}>
            {labels.name}
          </label>
          <input id="new-name" name="name" required minLength={2} maxLength={120} defaultValue={v?.name ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-email" className={labelClass}>
            {labels.email}
          </label>
          <input id="new-email" name="email" type="email" required maxLength={254} defaultValue={v?.email ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-role" className={labelClass}>
            {labels.role}
          </label>
          <select id="new-role" name="role" defaultValue={v?.role ?? "ISSUER"} key={v?.role ?? "ISSUER"} className={inputClass}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.description}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="max-w-md">
        <label htmlFor="new-password" className={labelClass}>
          {labels.password}
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={200}
          className={inputClass}
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className="mt-1 text-xs text-slate-500">
          {labels.passwordHint}
        </p>
      </div>
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {labels.submit}
      </button>
    </form>
  );
}

type RowLabels = {
  changeRole: string;
  deactivate: string;
  activate: string;
  reset2fa: string;
  unlock: string;
  resetPassword: string;
  confirmReset2fa: string;
  confirmDeactivate: string;
  hint: string;
};

type RowUser = { id: string; role: Role; isActive: boolean; isLocked: boolean; totpEnabled: boolean };

export function UserRowActions({ user, roles, labels }: { user: RowUser; roles: RoleOption[]; labels: RowLabels }) {
  const [state, action, pending] = useActionState(manageUserAction, { status: "idle" } as UserActionState);

  const opButton = (op: string, label: string, tone: "secondary" | "danger", confirmText?: string) => (
    <button
      type="submit"
      name="op"
      value={op}
      disabled={pending}
      className={buttonClass[tone]}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={user.id} />
        <label className="sr-only" htmlFor={`role-${user.id}`}>
          {labels.changeRole}
        </label>
        <select id={`role-${user.id}`} name="role" defaultValue={user.role} className={`${inputBase} py-1.5`}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {opButton("role", labels.changeRole, "secondary")}
        {user.isLocked ? opButton("unlock", labels.unlock, "secondary") : null}
        {opButton("resetPassword", labels.resetPassword, "secondary")}
        {user.totpEnabled ? opButton("reset2fa", labels.reset2fa, "danger", labels.confirmReset2fa) : null}
        {user.isActive
          ? opButton("deactivate", labels.deactivate, "danger", labels.confirmDeactivate)
          : opButton("activate", labels.activate, "secondary")}
      </form>
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>
          {state.message}
          <TempPassword state={state} hint={labels.hint} />
        </Alert>
      ) : null}
    </div>
  );
}
