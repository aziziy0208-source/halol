import { z } from "zod";

/** Strips control characters (incl. CR/LF, so nothing can leak into mail headers). */
const singleLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

export const contactSchema = z.object({
  name: z
    .string()
    .transform(singleLine)
    .pipe(z.string().min(2, "Bitte geben Sie Ihren Namen ein.").max(200, "Der Name ist zu lang.")),
  email: z
    .string()
    .trim()
    .max(254, "Die E-Mail-Adresse ist zu lang.")
    .pipe(z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein.")),
  message: z
    .string()
    .trim()
    .min(10, "Bitte geben Sie eine Nachricht ein (mindestens 10 Zeichen).")
    .max(5000, "Die Nachricht ist zu lang (maximal 5000 Zeichen)."),
});

export type ContactField = keyof z.infer<typeof contactSchema>;

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ContactField, string>>;
  values?: Partial<Record<ContactField, string>>;
};

export const CONTACT_INITIAL_STATE: ContactFormState = { status: "idle" };
