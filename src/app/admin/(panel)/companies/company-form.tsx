"use client";

import { useActionState } from "react";
import { ActionMessage, useActionRedirect } from "@/components/admin/action-feedback";
import { CompanyFields, type CompanyFieldValues } from "@/components/admin/company-fields";
import { buttonClass, labelClass } from "@/components/admin/ui";
import { useAdminMessages } from "@/i18n/admin/client";
import type { ActionState } from "@/lib/admin-actions";
import { deleteCompanyAction, saveCompanyAction } from "./actions";

const IDLE: ActionState = { status: "idle" };

export function CompanyForm({
  id,
  defaults,
  readOnly,
  logo,
}: {
  id?: string;
  defaults?: CompanyFieldValues;
  readOnly?: boolean;
  /** Current logo as a data: URI (private file). */
  logo?: string | null;
}) {
  const t = useAdminMessages().companies;
  const [state, action, pending] = useActionState(saveCompanyAction, IDLE);
  useActionRedirect(state);
  return (
    <form action={action} className="space-y-4 p-5">
      <ActionMessage state={state} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <CompanyFields idPrefix="company" defaults={defaults} readOnly={readOnly} />
      <div>
        <p className={labelClass}>{t.logo}</p>
        <div className="mb-2 flex h-20 w-48 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- private data: URI
            <img src={logo} alt={t.logo} className="max-h-16 max-w-44 object-contain" />
          ) : (
            <span className="text-xs text-slate-400">{t.noLogo}</span>
          )}
        </div>
        {readOnly ? null : (
          <>
            <input
              id="company-logo"
              name="logo"
              type="file"
              aria-label={t.logo}
              accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
              className="block text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-slate-700"
            />
            {logo ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="removeLogo" className="accent-brand-ink" /> {t.removeLogo}
              </label>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">{t.logoHint}</p>
          </>
        )}
      </div>
      {readOnly ? null : (
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {t.save}
        </button>
      )}
    </form>
  );
}

export function DeleteCompanyButton({ id }: { id: string }) {
  const t = useAdminMessages().companies;
  const [state, action, pending] = useActionState(deleteCompanyAction, IDLE);
  useActionRedirect(state);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <ActionMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClass.danger}
        onClick={(e) => {
          if (!window.confirm(t.confirmRemove)) e.preventDefault();
        }}
      >
        {t.remove}
      </button>
    </form>
  );
}
