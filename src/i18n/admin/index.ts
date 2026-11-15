import { type AdminMessages, en } from "./en";
import { uz } from "./uz";

export type { AdminMessages };

/**
 * Admin panel languages. The choice is stored in the `whu_admin_lang` cookie
 * (see ./server.ts and the switcher in the sidebar / sign-in page).
 * To add a language, copy en.ts, translate it and register it here.
 */
const DICTIONARIES = { en, uz } satisfies Record<string, AdminMessages>;

export type AdminLocale = keyof typeof DICTIONARIES;
export const ADMIN_LOCALES = Object.keys(DICTIONARIES) as AdminLocale[];
export const DEFAULT_ADMIN_LOCALE: AdminLocale = "en";
export const ADMIN_LOCALE_COOKIE = "whu_admin_lang";
export const ADMIN_LOCALE_NAMES: Record<AdminLocale, string> = { en: "English", uz: "Oʻzbekcha" };

export function isAdminLocale(value: unknown): value is AdminLocale {
  return typeof value === "string" && value in DICTIONARIES;
}

/** Admin texts in one language. Server code passes the request's locale (./server.ts), client code uses useAdminMessages(). */
export function adminMessages(locale: AdminLocale = DEFAULT_ADMIN_LOCALE): AdminMessages {
  return DICTIONARIES[locale];
}
