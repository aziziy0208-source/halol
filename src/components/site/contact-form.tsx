"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitContact } from "@/lib/contact/action";
import { CONTACT_INITIAL_STATE, type ContactField } from "@/lib/contact/schema";

type Labels = { heading: string; name: string; email: string; message: string; submit: string };

const inputClass =
  "block border border-[#ccc] bg-white px-1 py-1.5 text-[#444] outline-none focus:border-[#aaa] focus:shadow-[0_0_3px_rgba(0,0,0,0.2)] aria-[invalid=true]:border-red-600";

export function ContactForm({ labels }: { labels: Labels }) {
  const [state, formAction, pending] = useActionState(submitContact, CONTACT_INITIAL_STATE);
  const error = (field: ContactField) => state.fieldErrors?.[field];

  if (state.status === "success") {
    return (
      <div role="status" className="rounded bg-brand/10 px-4 py-6 text-center text-[#2b2b2b]">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="mb-5 overflow-hidden">
      {state.status === "error" && state.message ? (
        <p role="alert" className="mb-3 rounded bg-red-600 px-3 py-1.5 text-sm text-white">
          {state.message}
        </p>
      ) : null}

      {(["name", "email"] as const).map((field, i) => (
        <div key={field}>
          <label
            htmlFor={`contact-${field}`}
            className={`mb-1.5 block text-[13px] text-[#767676] ${i === 0 ? "" : "mt-3"}`}
          >
            {labels[field]}
          </label>
          <input
            id={`contact-${field}`}
            name={field}
            type={field === "email" ? "email" : "text"}
            autoComplete={field}
            required
            maxLength={field === "email" ? 254 : 200}
            defaultValue={state.values?.[field]}
            aria-invalid={Boolean(error(field))}
            aria-describedby={error(field) ? `contact-${field}-error` : undefined}
            className={`${inputClass} w-full sm:w-[54%]`}
          />
          {error(field) ? (
            <p id={`contact-${field}-error`} className="mt-1 text-sm text-red-700">
              {error(field)}
            </p>
          ) : null}
        </div>
      ))}

      <label htmlFor="contact-message" className="mt-3 mb-1.5 block text-[13px] text-[#767676]">
        {labels.message}
      </label>
      <textarea
        id="contact-message"
        name="message"
        rows={5}
        required
        maxLength={5000}
        defaultValue={state.values?.message}
        aria-invalid={Boolean(error("message"))}
        aria-describedby={error("message") ? "contact-message-error" : undefined}
        className={`${inputClass} w-full`}
      />
      {error("message") ? (
        <p id="contact-message-error" className="mt-1 text-sm text-red-700">
          {error("message")}
        </p>
      ) : null}

      {/* Honeypot — hidden from people and assistive tech, attractive to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="mt-3 text-xs leading-[18px] text-[#767676]">
        Ihre Angaben verwenden wir ausschließlich zur Bearbeitung Ihrer Anfrage. Weitere Informationen
        finden Sie in unserer{" "}
        <Link href="/datenschutz" className="text-brand-ink underline">
          Datenschutzerklärung
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={pending}
        className="float-right mt-2.5 min-h-8 rounded-[3px] bg-brand-ink px-3 py-1.5 text-[13px] text-white transition-colors duration-200 hover:bg-[#2b2b2b] disabled:opacity-60"
      >
        {pending ? "Wird gesendet …" : labels.submit}
      </button>
    </form>
  );
}
