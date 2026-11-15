"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { mailEnabled, sendContactNotification } from "@/lib/mail";
import { clientIp, hashIp } from "@/lib/security/ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { type ContactField, type ContactFormState, contactSchema } from "./schema";
import { contactTexts } from "./texts";

const LIMIT = 5; // messages
const WINDOW_SECONDS = 60 * 60; // per hour and IP

export async function submitContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const lang = formData.get("lang") === "en" ? "en" : "de";
  const t = contactTexts(lang);
  const SUCCESS: ContactFormState = { status: "success", message: t.success };
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  // Honeypot: real visitors never see or fill this field. Bots get a fake success.
  if (String(formData.get("website") ?? "") !== "") return SUCCESS;

  const parsed = contactSchema(lang).safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: t.checkInput, fieldErrors, values: raw };
  }

  const ipHash = hashIp(clientIp(await headers()));
  const limit = await consumeRateLimit(`contact:${ipHash}`, LIMIT, WINDOW_SECONDS);
  if (!limit.allowed) {
    return {
      status: "error",
      message: t.tooMany,
      values: raw,
    };
  }

  const saved = await prisma.contactMessage.create({ data: { ...parsed.data, ipHash } });

  // The message is safe in the database; a mail failure must not lose it or show an error.
  if (mailEnabled()) {
    try {
      await sendContactNotification({ ...parsed.data, receivedAt: saved.createdAt });
    } catch (error) {
      console.error("[contact] notification e-mail failed for message", saved.id, error);
    }
  } else {
    console.warn("[contact] SMTP not configured — message", saved.id, "stored only in the database");
  }

  return SUCCESS;
}
