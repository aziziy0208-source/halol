import type { ReactNode } from "react";

/** Shared admin styling primitives (neutral UI with the WHU accent colour). */

/** Field styling without a width, for inline controls. */
export const inputBase =
  "block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30 aria-[invalid=true]:border-red-500";

export const inputClass = `${inputBase} w-full`;

export const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#006a8f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60",
  link: "text-sm font-medium text-brand-ink underline-offset-2 hover:underline",
} as const;

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-sans text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

export function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
      <h2 className="font-sans text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

/** Loading indicator (shown before the admin's language is known, hence both languages). */
export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center p-10 text-sm text-slate-500">
      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" className="opacity-75" />
      </svg>
      Loading… · Yuklanmoqda…
    </div>
  );
}
