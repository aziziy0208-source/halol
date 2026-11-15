import { ASSET_ORIGIN, renderPdf } from "@/certificates/renderer";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { fileResponse } from "@/lib/http";
import { parseVariant, sampleHtml } from "../../sample";

// Certificate rendering (headless Chromium, cold start on serverless hosts) can take a while.
export const maxDuration = 60;

/** Watermarked sample PDF of the current template (for design review). */
export async function GET(request: Request, { params }: RouteContext<"/admin/certificates/template/files/[file]">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.view")) return new Response("Forbidden", { status: 403 });
  const { file } = await params;
  if (file !== "sample.pdf") return new Response("Not found", { status: 404 });
  const variant = parseVariant(new URL(request.url).searchParams.get("variant"));
  const { pdf } = await renderPdf(await sampleHtml(variant, { assetBase: ASSET_ORIGIN, mode: "print" }));
  return fileResponse(pdf, "application/pdf", `WHU-Zertifikat-Muster-${variant}.pdf`);
}
