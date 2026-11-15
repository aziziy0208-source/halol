"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isVerifyLang, verifyTexts } from "@/i18n/verify";
import { verifyAltchaPayload } from "@/lib/verify/altcha";
import { findTokenByNumber, normalizeCertificateNumber } from "@/lib/verify/lookup";
import { withinLimit } from "@/lib/verify/requests";

export type ManualCheckState = { status: "idle" | "error"; message?: string; notFound?: boolean };

/**
 * Manual check by certificate number (spec §8.3): rate limit → ALTCHA → lookup.
 * A hit continues on the same result page as the QR code (/v/{token}).
 */
export async function checkCertificateAction(_prev: ManualCheckState, formData: FormData): Promise<ManualCheckState> {
  const langValue = formData.get("lang");
  const lang = isVerifyLang(langValue) ? langValue : "de";
  const t = verifyTexts(lang).manual;
  const raw = formData.get("number");
  const number = typeof raw === "string" ? normalizeCertificateNumber(raw) : "";
  if (number.length < 3) return { status: "error", message: t.invalidNumber };

  const h = await headers();
  if (!(await withinLimit("manual", h))) return { status: "error", message: t.rateLimited };
  if (!(await verifyAltchaPayload(formData.get("altcha")))) return { status: "error", message: t.captcha };

  const token = await findTokenByNumber(number);
  if (!token) return { status: "error", message: t.notFound(number), notFound: true };
  redirect(`/v/${token}?lang=${lang}&via=manual`);
}
