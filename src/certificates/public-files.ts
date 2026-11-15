import "server-only";
import { certificateFileKeys, storage } from "@/lib/storage";
import { ensureIssuedFiles, readIssuedPdf } from "./files";
import { findCertificate } from "./load";
import { previewWebp } from "./renderer";

/**
 * Files behind the public verification page. Callers decide whether a document
 * may be shown at all (only valid, non-legacy certificates); these helpers only
 * read the stored official files (rendered once, checksum-verified).
 */
export async function publicPdf(certificateId: string): Promise<{ pdf: Buffer; filename: string } | null> {
  const cert = await findCertificate(certificateId);
  if (!cert?.certificateNumber) return null;
  const files = await ensureIssuedFiles(cert, null);
  const suffix = cert.revision > 0 ? `-Rev${cert.revision}` : "";
  return { pdf: await readIssuedPdf(files), filename: `${cert.certificateNumber}${suffix}.pdf` };
}

/** WebP preview (~10× smaller than the PNG), derived from the stored preview once and kept. */
export async function publicPreview(certificateId: string): Promise<Buffer | null> {
  const cert = await findCertificate(certificateId);
  if (!cert?.certificateNumber) return null;
  const files = await ensureIssuedFiles(cert, null);
  const key = certificateFileKeys(cert.certificateNumber, cert.revision).webPreview;
  const cached = await storage().get(key);
  if (cached) return cached;
  const png = await storage().get(files.previewKey);
  if (!png) return null;
  const webp = await previewWebp(png);
  if (!webp) return null;
  await storage().put(key, webp, "image/webp");
  return webp;
}
