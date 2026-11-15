import type { CertificateDocument, RenderOptions } from "../document";
import { renderCertificateV1 } from "./v1/render";
import { renderCertificateV2 } from "./v2/render";

/**
 * Template registry. A certificate stores the templateVersion it was issued
 * with and is always rendered with exactly that version, so a later design
 * change never alters an issued certificate (spec §5.3).
 */
const TEMPLATES: Record<number, (doc: CertificateDocument, options: RenderOptions) => string> = {
  1: renderCertificateV1,
  2: renderCertificateV2,
};

/** Version used for new certificates: 2 = WHU's official design; 1 = the provisional design of stage 5. */
export const CURRENT_TEMPLATE_VERSION = 2;

export function renderCertificateHtml(templateVersion: number, doc: CertificateDocument, options: RenderOptions): string {
  const render = TEMPLATES[templateVersion];
  if (!render) throw new Error(`Unknown certificate template version ${templateVersion}`);
  return render(doc, options);
}
