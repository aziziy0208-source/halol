"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/admin/action-feedback";
import { buttonClass, inputBase, inputClass, labelClass } from "@/components/admin/ui";
import type { ActionState } from "@/lib/admin-actions";
import { useAdminMessages } from "@/i18n/admin/client";
import {
  saveGeneralSettingsAction,
  saveSignatoryAction,
  saveStandardAction,
  signatoryOpAction,
  toggleStandardAction,
} from "./actions";

const IDLE: ActionState = { status: "idle" };

// Texts are read here (not passed as props): some are functions, which cannot cross the server/client boundary.
const useTexts = () => useAdminMessages().settings;

export function GeneralSettingsForm({
  values,
  nextNumber,
}: {
  values: { numberFormat: string; defaultValidityMonths: number; fourEyes: boolean };
  nextNumber: string;
}) {
  const t = useTexts().general;
  const [state, action, pending] = useActionState(saveGeneralSettingsAction, IDLE);
  return (
    <form action={action} className="space-y-4 p-5">
      <ActionMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="numberFormat" className={labelClass}>
            {t.numberFormat}
          </label>
          <input
            id="numberFormat"
            name="numberFormat"
            defaultValue={values.numberFormat}
            required
            maxLength={40}
            className={`${inputClass} font-mono`}
            aria-describedby="numberFormat-hint"
          />
          <p id="numberFormat-hint" className="mt-1 text-xs text-slate-500">
            {t.numberFormatHint} <span className="font-mono text-slate-800">{nextNumber}</span>
          </p>
        </div>
        <div>
          <label htmlFor="defaultValidityMonths" className={labelClass}>
            {t.validity}
          </label>
          <input
            id="defaultValidityMonths"
            name="defaultValidityMonths"
            type="number"
            min={1}
            max={60}
            required
            defaultValue={values.defaultValidityMonths}
            className={`${inputBase} w-32`}
            aria-describedby="validity-hint"
          />
          <p id="validity-hint" className="mt-1 text-xs text-slate-500">
            {t.validityHint}
          </p>
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="fourEyes" defaultChecked={values.fourEyes} className="mt-0.5 h-4 w-4 accent-brand-ink" />
        <span>
          <span className="font-medium text-slate-800">{t.fourEyes}</span>
          <span className="block text-xs text-slate-500">{t.fourEyesHint}</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {t.save}
      </button>
    </form>
  );
}

type StandardRowData = { id: string; code: string; title: string; isActive: boolean; usage: number };

export function StandardRow({ standard }: { standard: StandardRowData }) {
  const t = useTexts().standards;
  const [state, action, pending] = useActionState(saveStandardAction, IDLE);
  const [toggleState, toggle, toggling] = useActionState(toggleStandardAction, IDLE);
  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <form action={action} className="flex flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={standard.id} />
          <div className="w-48">
            <label htmlFor={`code-${standard.id}`} className={labelClass}>
              {t.code}
            </label>
            <input id={`code-${standard.id}`} name="code" defaultValue={standard.code} required maxLength={80} className={inputClass} />
          </div>
          <div className="min-w-60 flex-1">
            <label htmlFor={`title-${standard.id}`} className={labelClass}>
              {t.name}
            </label>
            <input id={`title-${standard.id}`} name="title" defaultValue={standard.title} required maxLength={300} className={inputClass} />
          </div>
          <button type="submit" disabled={pending} className={buttonClass.secondary}>
            {t.save}
          </button>
        </form>
        <form action={toggle}>
          <input type="hidden" name="id" value={standard.id} />
          <input type="hidden" name="active" value={standard.isActive ? "0" : "1"} />
          <button type="submit" disabled={toggling} className={standard.isActive ? buttonClass.danger : buttonClass.secondary}>
            {standard.isActive ? t.deactivate : t.activate}
          </button>
        </form>
      </div>
      <p className="text-xs text-slate-500">
        {standard.isActive ? null : <span className="mr-2 font-semibold text-amber-700">{t.inactive}</span>}
        {t.usage(standard.usage)}
      </p>
      <ActionMessage state={state.status === "error" ? state : toggleState.status === "error" ? toggleState : IDLE} />
    </li>
  );
}

export function StandardCreateForm() {
  const t = useTexts().standards;
  const [state, action, pending] = useActionState(saveStandardAction, IDLE);
  return (
    <form action={action} className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
      <ActionMessage state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label htmlFor="new-standard-code" className={labelClass}>
            {t.code}
          </label>
          <input id="new-standard-code" name="code" required maxLength={80} className={inputClass} />
        </div>
        <div className="min-w-60 flex-1">
          <label htmlFor="new-standard-title" className={labelClass}>
            {t.name}
          </label>
          <input id="new-standard-title" name="title" required maxLength={300} className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {t.add}
        </button>
      </div>
    </form>
  );
}

type SignatoryData = {
  id: string;
  name: string;
  title: string;
  isActive: boolean;
  signature: string | null;
  stamp: string | null;
};

function ImageField({
  id,
  name,
  label,
  current,
}: {
  id: string;
  name: "signature" | "stamp";
  label: string;
  current: string | null;
}) {
  const t = useTexts().signatories;
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mb-2 flex h-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- private data: URI, not optimisable
          <img src={current} alt={label} className="max-h-20 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">{t.noImage}</span>
        )}
      </div>
      <label htmlFor={id} className="mb-1 block text-xs text-slate-600">
        {t.replace}
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        className="block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-slate-700"
      />
    </div>
  );
}

export function SignatoryCard({ signatory }: { signatory: SignatoryData }) {
  const t = useTexts().signatories;
  const [state, action, pending] = useActionState(saveSignatoryAction, IDLE);
  const [opState, op, opPending] = useActionState(signatoryOpAction, IDLE);
  const s = signatory;
  return (
    <li className={`space-y-3 px-5 py-4 ${s.isActive ? "" : "bg-slate-50"}`}>
      <ActionMessage state={state} />
      <ActionMessage state={opState.status === "error" ? opState : IDLE} />
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={s.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor={`name-${s.id}`} className={labelClass}>
              {t.name} {s.isActive ? null : <span className="text-xs font-semibold text-amber-700">({t.inactive})</span>}
            </label>
            <input id={`name-${s.id}`} name="name" defaultValue={s.name} required maxLength={120} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`title-${s.id}`} className={labelClass}>
              {t.position}
            </label>
            <input id={`title-${s.id}`} name="title" defaultValue={s.title} required maxLength={120} className={inputClass} />
          </div>
          <ImageField id={`signature-${s.id}`} name="signature" label={t.signature} current={s.signature} />
          <ImageField id={`stamp-${s.id}`} name="stamp" label={t.stamp} current={s.stamp} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {t.save}
        </button>
      </form>
      <form action={op} className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <input type="hidden" name="id" value={s.id} />
        {s.signature ? (
          <button
            type="submit"
            name="op"
            value="removeSignature"
            disabled={opPending}
            className={buttonClass.secondary}
            onClick={(e) => {
              if (!window.confirm(t.confirmRemoveImage)) e.preventDefault();
            }}
          >
            {t.removeImage}: {t.signature}
          </button>
        ) : null}
        {s.stamp ? (
          <button
            type="submit"
            name="op"
            value="removeStamp"
            disabled={opPending}
            className={buttonClass.secondary}
            onClick={(e) => {
              if (!window.confirm(t.confirmRemoveImage)) e.preventDefault();
            }}
          >
            {t.removeImage}: {t.stamp}
          </button>
        ) : null}
        <button
          type="submit"
          name="op"
          value={s.isActive ? "deactivate" : "activate"}
          disabled={opPending}
          className={s.isActive ? buttonClass.danger : buttonClass.secondary}
        >
          {s.isActive ? t.deactivate : t.activate}
        </button>
      </form>
    </li>
  );
}

export function SignatoryCreateForm() {
  const t = useTexts().signatories;
  const [state, action, pending] = useActionState(saveSignatoryAction, IDLE);
  return (
    <form action={action} className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
      <ActionMessage state={state} />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="new-signatory-name" className={labelClass}>
            {t.name}
          </label>
          <input id="new-signatory-name" name="name" required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-signatory-title" className={labelClass}>
            {t.position}
          </label>
          <input id="new-signatory-title" name="title" required maxLength={120} className={inputClass} />
        </div>
        <ImageField id="new-signatory-signature" name="signature" label={t.signature} current={null} />
        <ImageField id="new-signatory-stamp" name="stamp" label={t.stamp} current={null} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {t.add}
      </button>
    </form>
  );
}
