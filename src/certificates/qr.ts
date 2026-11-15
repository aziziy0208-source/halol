import QRCode from "qrcode";

/** Spec §5.3: error correction Q (25 % of the code may be damaged), ≥ 25 mm, with quiet zone. */
export const QR_ERROR_CORRECTION = "Q" as const;
/** ISO/IEC 18004 quiet zone: 4 modules of white around the code. */
export const QR_QUIET_ZONE_MODULES = 4;
/** Printed edge length of the code itself (modules only), slightly above the 25 mm minimum. */
export const QR_CODE_EDGE_MM = 26;

export function verificationUrl(baseUrl: string, publicToken: string): string {
  return `${baseUrl.replace(/\/$/, "")}/v/${publicToken}`;
}

/** "https://halal-zertifizierung.de/v/Ab…" → "halal-zertifizierung.de/v/Ab…" (printed under the QR code). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export async function qrCodeSvg(url: string): Promise<{ svg: string; sizeMm: number; modules: number }> {
  const modules = QRCode.create(url, { errorCorrectionLevel: QR_ERROR_CORRECTION }).modules.size;
  const total = modules + 2 * QR_QUIET_ZONE_MODULES;
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    margin: QR_QUIET_ZONE_MODULES,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return { svg, sizeMm: Math.round(((QR_CODE_EDGE_MM * total) / modules) * 10) / 10, modules };
}

/** High-resolution PNG of the QR code alone (for packaging and documents). */
export function qrCodePng(url: string, widthPx = 1200): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    margin: QR_QUIET_ZONE_MODULES,
    width: widthPx,
  });
}

/** Standalone SVG file (with XML header) of the QR code alone. */
export async function qrCodeSvgFile(url: string): Promise<string> {
  const { svg } = await qrCodeSvg(url);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}
