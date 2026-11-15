import { ensureIssuedFiles, readIssuedPdf } from "@/certificates/files";
import { findCertificate, isUnissued, printHtml } from "@/certificates/load";
import { qrCodePng, qrCodeSvgFile, verificationUrl } from "@/certificates/qr";
import { renderPdf, renderPng } from "@/certificates/renderer";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { siteUrl } from "@/lib/env";
import { fileResponse } from "@/lib/http";
import { storage } from "@/lib/storage";

// Certificate rendering (headless Chromium, cold start on serverless hosts) can take a while.
export const maxDuration = 60;

/**
 * Private certificate files for the admin panel:
 *   certificate.pdf / certificate.png — issued: the stored official files (rendered once);
 *                                       draft: rendered on the fly with the DRAFT watermark
 *   qr.svg / qr.png                   — the verification QR code alone, for packaging
 */
export async function GET(_request: Request, { params }: RouteContext<"/admin/certificates/[id]/files/[file]">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.view")) return new Response("Forbidden", { status: 403 });
  const { id, file } = await params;
  const cert = await findCertificate(id);
  if (!cert) return new Response("Not found", { status: 404 });

  const draft = isUnissued(cert.status);
  const base = draft
    ? `ENTWURF-${cert.id}`
    : `${cert.certificateNumber}${cert.revision > 0 ? `-Rev${cert.revision}` : ""}`;

  // Imported legacy certificates have no generated document (the paper original applies).
  if (cert.isLegacy && (file === "certificate.pdf" || file === "certificate.png")) {
    return new Response("Legacy certificate: no generated document", { status: 404 });
  }

  switch (file) {
    case "certificate.pdf": {
      if (draft) return fileResponse((await renderPdf(await printHtml(cert))).pdf, "application/pdf", `${base}.pdf`);
      const files = await ensureIssuedFiles(cert, user.id);
      return fileResponse(await readIssuedPdf(files), "application/pdf", `${base}.pdf`);
    }
    case "certificate.png": {
      if (draft) return fileResponse(await renderPng(await printHtml(cert), { scale: 2 }), "image/png", `${base}.png`);
      const files = await ensureIssuedFiles(cert, user.id);
      const png = await storage().get(files.previewKey);
      if (!png) return new Response("Preview missing", { status: 500 });
      return fileResponse(png, "image/png", `${base}.png`);
    }
    case "qr.svg":
    case "qr.png": {
      if (draft || !cert.publicToken) return new Response("Not issued yet", { status: 404 });
      const url = verificationUrl(siteUrl(), cert.publicToken);
      return file === "qr.svg"
        ? fileResponse(await qrCodeSvgFile(url), "image/svg+xml", `${base}-QR.svg`)
        : fileResponse(await qrCodePng(url), "image/png", `${base}-QR.png`);
    }
    default:
      return new Response("Not found", { status: 404 });
  }
}
