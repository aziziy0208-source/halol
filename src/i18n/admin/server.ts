import "server-only";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, type AdminLocale, type AdminMessages, adminMessages, DEFAULT_ADMIN_LOCALE, isAdminLocale } from "./index";

/** The signed-in admin's language (cookie), default English. */
export async function adminLocale(): Promise<AdminLocale> {
  const value = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return isAdminLocale(value) ? value : DEFAULT_ADMIN_LOCALE;
}

/** Admin texts for the current request (server components, server actions, route handlers). */
export async function adminT(): Promise<AdminMessages> {
  return adminMessages(await adminLocale());
}
