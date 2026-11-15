import { z } from "zod";
import type { SiteLang } from "@/i18n/site";
import { contactTexts } from "./texts";

/** Strips control characters (incl. CR/LF, so nothing can leak into mail headers). */
const singleLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

export function contactSchema(lang: SiteLang = "de") {
  const t = contactTexts(lang);
  return z.object({
    name: z.string().transform(singleLine).pipe(z.string().min(2, t.nameRequired).max(200, t.nameTooLong)),
    email: z.string().trim().max(254, t.emailTooLong).pipe(z.email(t.emailInvalid)),
    message: z.string().trim().min(10, t.messageTooShort).max(5000, t.messageTooLong),
  });
}

export type ContactField = keyof z.infer<ReturnType<typeof contactSchema>>;

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ContactField, string>>;
  values?: Partial<Record<ContactField, string>>;
};

export const CONTACT_INITIAL_STATE: ContactFormState = { status: "idle" };
