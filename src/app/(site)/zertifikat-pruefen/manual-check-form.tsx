"use client";

import type {} from "altcha/types/react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { type VerifyLang, verifyTexts } from "@/i18n/verify";
import { checkCertificateAction, type ManualCheckState } from "./actions";

/** Certificate number + ALTCHA proof-of-work (loaded only on this page). */
export function ManualCheckForm({ lang }: { lang: VerifyLang }) {
  const t = verifyTexts(lang);
  const [state, action, pending] = useActionState(checkCertificateAction, { status: "idle" } as ManualCheckState);
  const [number, setNumber] = useState("");
  const [widgetReady, setWidgetReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const widget = useRef<HTMLElement & { reset?: () => void }>(null);

  useEffect(() => {
    let cancelled = false;
    // The German strings must be registered before the widget initialises.
    Promise.all([import("altcha"), lang === "de" ? import("altcha/i18n/de") : null]).then(() => {
      if (!cancelled) setWidgetReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    const el = widget.current;
    if (!el) return;
    const onChange = (e: Event) => setVerified((e as CustomEvent<{ state: string }>).detail?.state === "verified");
    el.addEventListener("statechange", onChange);
    return () => el.removeEventListener("statechange", onChange);
  }, [widgetReady]);

  // Every answer consumed the solved challenge: start a fresh one for the next try.
  useEffect(() => {
    if (state.status === "error") widget.current?.reset?.();
  }, [state]);

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="lang" value={lang} />
      <div>
        <label htmlFor="certificate-number" className="mb-1 block font-semibold text-[#333]">
          {t.manual.number}
        </label>
        <input
          id="certificate-number"
          name="number"
          required
          maxLength={60}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t.manual.placeholder}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby={state.status === "error" ? "manual-check-error" : undefined}
          className="block w-full rounded border border-[#c9c9c9] px-3 py-2.5 font-mono text-lg tracking-wide uppercase outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="min-h-[74px]">
        {widgetReady ? (
          <altcha-widget
            ref={widget}
            challenge="/api/altcha"
            name="altcha"
            language={lang}
            auto="onfocus"
            configuration={JSON.stringify({ humanInteractionSignature: false })}
          />
        ) : null}
        <p className="mt-1 text-sm text-[#6b6b6b]">{t.manual.humanHint}</p>
      </div>
      {state.status === "error" && state.message ? (
        <div id="manual-check-error" role="alert" className="rounded border border-[#e7b4b4] bg-[#fdf1f1] px-4 py-3 text-[#7f1d1d]">
          <p>{state.message}</p>
          {state.notFound ? (
            <p className="mt-1 text-sm">
              {t.notFound.warning}{" "}
              <Link href="/#contact" className="underline">
                {lang === "de" ? "Kontakt" : "Contact"}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending || !verified}
        className="rounded bg-brand-ink px-6 py-2.5 font-semibold text-white hover:bg-[#006a8f] disabled:opacity-60"
      >
        {pending ? t.manual.checking : t.manual.submit}
      </button>
    </form>
  );
}
