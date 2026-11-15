import "server-only";
import { createHash } from "node:crypto";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { certificateFileKeys, storage } from "@/lib/storage";
import { isUnissued, type LoadedCertificate, printHtml } from "./load";
import { renderPdf, renderPng } from "./renderer";

export type StoredFiles = { pdfKey: string; previewKey: string; pdfSha256: string };

/**
 * Official files of an issued certificate: rendered once, stored privately with
 * a SHA-256 of the PDF, and never re-rendered afterwards (spec §7.3).
 * Certificates issued before files existed (seed, legacy import) get them on first use.
 */
export async function ensureIssuedFiles(cert: LoadedCertificate, actorId: string | null): Promise<StoredFiles> {
  if (isUnissued(cert.status) || !cert.certificateNumber || !cert.publicToken) {
    throw new Error("Only issued certificates have stored files");
  }
  if (cert.isLegacy) {
    // Imported paper certificates: re-rendering them in today's template would create a document WHU never issued.
    throw new Error("Legacy certificates have no generated files");
  }
  if (cert.pdfKey && cert.previewKey && cert.pdfSha256) {
    return { pdfKey: cert.pdfKey, previewKey: cert.previewKey, pdfSha256: cert.pdfSha256 };
  }
  const html = await printHtml(cert);
  const { pdf } = await renderPdf(html);
  const preview = await renderPng(html, { scale: 2 });
  const keys = certificateFileKeys(cert.certificateNumber, cert.revision);
  await storage().put(keys.pdf, pdf, "application/pdf");
  await storage().put(keys.preview, preview, "image/png");
  const pdfSha256 = createHash("sha256").update(pdf).digest("hex");

  // Only the first writer records the files (two parallel first downloads render the same content).
  const updated = await prisma.certificate.updateMany({
    where: { id: cert.id, pdfKey: null },
    data: { pdfKey: keys.pdf, previewKey: keys.preview, pdfSha256 },
  });
  if (updated.count === 1) {
    await audit({
      userId: actorId,
      action: "certificate.files.generate",
      entityType: "Certificate",
      entityId: cert.id,
      after: { pdfKey: keys.pdf, previewKey: keys.preview, pdfSha256, templateVersion: cert.templateVersion },
    });
    return { pdfKey: keys.pdf, previewKey: keys.preview, pdfSha256 };
  }
  const current = await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } });
  return { pdfKey: current.pdfKey!, previewKey: current.previewKey!, pdfSha256: current.pdfSha256! };
}

/** Reads a stored file and checks the PDF against its recorded SHA-256 (tamper evidence). */
export async function readIssuedPdf(files: StoredFiles): Promise<Buffer> {
  const pdf = await storage().get(files.pdfKey);
  if (!pdf) throw new Error(`Stored PDF missing: ${files.pdfKey}`);
  const sha = createHash("sha256").update(pdf).digest("hex");
  if (sha !== files.pdfSha256) throw new Error(`PDF checksum mismatch for ${files.pdfKey}`);
  return pdf;
}
