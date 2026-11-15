import "server-only";
import type { CertificateSnapshot } from "@/lib/certificates/snapshot";
import { toIsoDate } from "@/lib/certificates/snapshot";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { storage } from "@/lib/storage";
import type { CertificateDocument, RenderOptions } from "./document";
import { displayUrl, qrCodeSvg, verificationUrl } from "./qr";
import { ASSET_ORIGIN } from "./assets";
import { CURRENT_TEMPLATE_VERSION, renderCertificateHtml } from "./templates";

const certificateInclude = {
  company: true,
  signatory: true,
  products: { orderBy: { sortOrder: "asc" } },
  standards: { include: { standard: true } },
} as const;

export type LoadedCertificate = NonNullable<Awaited<ReturnType<typeof findCertificate>>>;

export function findCertificate(id: string) {
  return prisma.certificate.findUnique({ where: { id }, include: certificateInclude });
}

/** Detects PNG/JPEG/SVG from the bytes and returns a data: URI (images stay private). */
function toDataUri(bytes: Buffer): string | null {
  const type =
    bytes[0] === 0x89 && bytes[1] === 0x50
      ? "image/png"
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? "image/jpeg"
        : bytes.subarray(0, 512).toString("utf8").includes("<svg")
          ? "image/svg+xml"
          : null;
  return type ? `data:${type};base64,${bytes.toString("base64")}` : null;
}

export async function imageDataUri(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const bytes = await storage().get(key);
  return bytes ? toDataUri(bytes) : null;
}

export function isUnissued(status: LoadedCertificate["status"]): boolean {
  return status === "DRAFT" || status === "PENDING_APPROVAL";
}

/** Verification block (URL + QR) for a public token. */
export async function verificationFor(publicToken: string | null): Promise<CertificateDocument["verification"]> {
  if (!publicToken) return null;
  const url = verificationUrl(siteUrl(), publicToken);
  const qr = await qrCodeSvg(url);
  return { url, displayUrl: displayUrl(url), qrSvg: qr.svg, qrSizeMm: qr.sizeMm };
}

/** Final (un-watermarked) document of an issued certificate, from its frozen snapshot. */
export async function documentFromSnapshot(
  snapshot: CertificateSnapshot,
  publicToken: string | null,
  fallbackImages: { signatureImageKey?: string | null; stampImageKey?: string | null } = {},
): Promise<CertificateDocument> {
  return {
    certificateNumber: snapshot.certificateNumber,
    revision: snapshot.revision,
    isDraft: false,
    watermark: null,
    company: snapshot.company,
    productionSite: snapshot.productionSite,
    scope: snapshot.scope,
    category: snapshot.category,
    standards: snapshot.standards,
    products: snapshot.products,
    issueDate: snapshot.issueDate,
    validUntil: snapshot.validUntil,
    auditDate: snapshot.auditDate,
    signatory: snapshot.signatory,
    images: {
      signature: await imageDataUri(snapshot.signatureImageKey ?? fallbackImages.signatureImageKey),
      stamp: await imageDataUri(snapshot.stampImageKey ?? fallbackImages.stampImageKey),
      companyLogo: await imageDataUri(snapshot.companyLogoKey),
    },
    verification: await verificationFor(publicToken),
  };
}

/**
 * Builds the template document. Issued certificates use their frozen snapshot;
 * drafts use the live data with a DRAFT watermark. Drafts already carry the
 * public token they will be issued with, so their preview shows the real QR code
 * (the verification page keeps treating drafts as "not found").
 */
export async function buildCertificateDocument(cert: LoadedCertificate): Promise<CertificateDocument> {
  const draft = isUnissued(cert.status);
  if (!draft && cert.snapshot) {
    return documentFromSnapshot(cert.snapshot as unknown as CertificateSnapshot, cert.publicToken, {
      signatureImageKey: cert.signatory?.signatureImageKey,
      stampImageKey: cert.signatory?.stampImageKey,
    });
  }

  return {
    certificateNumber: cert.certificateNumber,
    revision: cert.revision,
    isDraft: draft,
    watermark: draft ? "draft" : null,
    company: {
      name: cert.company.name,
      legalForm: cert.company.legalForm,
      address: cert.company.address,
      postalCode: cert.company.postalCode,
      city: cert.company.city,
      country: cert.company.country,
    },
    productionSite: cert.productionSite,
    scope: cert.scope,
    category: cert.category,
    standards: cert.standards.map((s) => ({ code: s.standard.code, title: s.standard.title })),
    products: cert.products.map((p) => ({ name: p.name, brand: p.brand, articleNo: p.articleNo, description: p.description })),
    issueDate: cert.issueDate ? toIsoDate(cert.issueDate) : null,
    validUntil: cert.validUntil ? toIsoDate(cert.validUntil) : null,
    auditDate: cert.auditDate ? toIsoDate(cert.auditDate) : null,
    signatory: cert.signatory ? { name: cert.signatory.name, title: cert.signatory.title } : null,
    images: {
      signature: await imageDataUri(cert.signatory?.signatureImageKey),
      stamp: await imageDataUri(cert.signatory?.stampImageKey),
      companyLogo: await imageDataUri(cert.company.logoImageKey),
    },
    verification: await verificationFor(cert.publicToken),
  };
}

export async function certificateHtml(cert: LoadedCertificate, options: RenderOptions): Promise<string> {
  // Drafts are previewed in the template they will be issued with; issued ones keep theirs.
  const version = isUnissued(cert.status) ? CURRENT_TEMPLATE_VERSION : cert.templateVersion;
  return renderCertificateHtml(version, await buildCertificateDocument(cert), options);
}

/** Print HTML for Playwright (assets served by the renderer's own origin). */
export function printHtml(cert: LoadedCertificate): Promise<string> {
  return certificateHtml(cert, { assetBase: ASSET_ORIGIN, mode: "print" });
}
