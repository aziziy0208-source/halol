import { publicPdf } from "@/certificates/public-files";
import { fileResponse } from "@/lib/http";
import { findPublicByToken } from "@/lib/verify/lookup";
import { withinLimit } from "@/lib/verify/requests";

// Certificate rendering (headless Chromium, cold start on serverless hosts) can take a while.
export const maxDuration = 60;

/** "PDF herunterladen" on the verification page — only while the certificate is valid. */
export async function GET(request: Request, { params }: RouteContext<"/v/[token]/certificate.pdf">) {
  if (!(await withinLimit("file", request.headers))) return new Response("Too many requests", { status: 429 });
  const cert = await findPublicByToken((await params).token);
  if (!cert?.documentAvailable) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const file = await publicPdf(cert.id);
  if (!file) return new Response("Not found", { status: 404 });
  const response = fileResponse(file.pdf, "application/pdf", file.filename);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
