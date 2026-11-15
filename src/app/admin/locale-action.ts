"use server";

import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, isAdminLocale } from "@/i18n/admin";

/** Stores the admin panel language (cookie on /admin, one year). The client reloads afterwards. */
export async function setAdminLocaleAction(locale: unknown): Promise<void> {
  if (!isAdminLocale(locale)) return;
  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/admin",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
