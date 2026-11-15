import "server-only";
import type { RenderOptions } from "@/certificates/document";
import { displayUrl, qrCodeSvg, verificationUrl } from "@/certificates/qr";
import { sampleDocument, type SampleVariant } from "@/certificates/sample";
import { CURRENT_TEMPLATE_VERSION, renderCertificateHtml } from "@/certificates/templates";
import { siteUrl } from "@/lib/env";

export const SAMPLE_VARIANTS: SampleVariant[] = ["short", "long", "draft"];

export function parseVariant(value: unknown): SampleVariant {
  return SAMPLE_VARIANTS.includes(value as SampleVariant) ? (value as SampleVariant) : "short";
}

/** Sample certificate HTML. The QR code points to an example token (not a real certificate). */
export async function sampleHtml(variant: SampleVariant, options: RenderOptions): Promise<string> {
  const url = verificationUrl(siteUrl(), "MUSTER0000000000");
  const qr = await qrCodeSvg(url);
  const doc = sampleDocument(variant, { url, displayUrl: displayUrl(url), qrSvg: qr.svg, qrSizeMm: qr.sizeMm });
  return renderCertificateHtml(CURRENT_TEMPLATE_VERSION, doc, options);
}
