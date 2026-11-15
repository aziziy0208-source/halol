"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type AdminLocale, type AdminMessages, adminMessages, DEFAULT_ADMIN_LOCALE } from "./index";

const LocaleContext = createContext<AdminLocale>(DEFAULT_ADMIN_LOCALE);

/** Makes the request's admin language available to client components. */
export function AdminLocaleProvider({ locale, children }: { locale: AdminLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useAdminLocale(): AdminLocale {
  return useContext(LocaleContext);
}

/** Admin texts in the current language (client components). */
export function useAdminMessages(): AdminMessages {
  return adminMessages(useContext(LocaleContext));
}
