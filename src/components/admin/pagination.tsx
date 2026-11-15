import Link from "next/link";
import { adminT } from "@/i18n/admin/server";
import { buttonClass } from "./ui";

export const PAGE_SIZE = 25;

/** First value of a search param. */
export function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function pageParam(value: string | string[] | undefined): number {
  const n = Number(param(value));
  return Number.isInteger(n) && n > 1 ? Math.min(n, 100_000) : 1;
}

/** Builds a list URL that keeps the current filters. */
export function listHref(base: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) query.set(k, String(v));
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  const t = (await adminT()).common;
  return (
    <nav aria-label={t.pageOf(page, pages)} className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass.secondary} rel="prev">
          ← {t.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-slate-500 tabular-nums">{t.pageOf(page, pages)}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClass.secondary} rel="next">
          {t.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
