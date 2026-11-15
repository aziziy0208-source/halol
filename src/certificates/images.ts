import "server-only";
import { createHash } from "node:crypto";
import { storage } from "@/lib/storage";
import { normalizeImage } from "./renderer";

/** Spec §9: uploads only PNG/JPG/SVG, size-limited, SVG sanitised. */
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;

export type SignatoryImageKind = "signature" | "stamp";
type ImageType = "image/png" | "image/jpeg" | "image/svg+xml";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Detects the real type from the bytes; the file name and the browser's MIME type are not trusted. */
export function sniffImageType(bytes: Buffer): ImageType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const head = bytes.subarray(0, 2048).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}

/**
 * Validates an uploaded signature/stamp image, re-encodes it as PNG in the
 * sandboxed browser (drops metadata and anything active inside SVGs) and stores
 * it privately under a content-addressed key. Old keys are never deleted:
 * snapshots of issued certificates keep pointing to the image they were issued with.
 * Returns null if the upload is not an acceptable image.
 */
export async function storeSignatoryImage(signatoryId: string, kind: SignatoryImageKind, file: File): Promise<string | null> {
  return storeImage(`signatories/${signatoryId}/${kind}`, file);
}

/** The certificate holder's logo (printed on certificates, template v2). Same rules as above. */
export async function storeCompanyLogo(companyId: string, file: File): Promise<string | null> {
  return storeImage(`companies/${companyId}/logo`, file);
}

async function storeImage(prefix: string, file: File): Promise<string | null> {
  if (file.size === 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return null;
  const image = await normalizeImage(bytes, type);
  if (!image || image.png.length === 0) return null;
  const hash = createHash("sha256").update(image.png).digest("hex").slice(0, 20);
  const key = `${prefix}-${hash}.png`;
  await storage().put(key, image.png, "image/png");
  return key;
}
