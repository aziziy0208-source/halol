"use client";

import { useEffect } from "react";

/**
 * The root layout renders <html lang="de">; English pages also mark their content with
 * lang="en" and switch the document language after hydration (screen readers, translators).
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = lang;
    return () => {
      root.lang = previous;
    };
  }, [lang]);
  return null;
}
