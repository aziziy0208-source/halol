import { publicPreview } from "@/certificates/public-files";
import { findPublicByToken } from "@/lib/verify/lookup";
import { withinLimit } from "@/lib/verify/requests";

// Certificate rendering (headless Chromium, cold start on serverless hosts) can take a while.
export const maxDuration = 60;

/** Preview image on the verification page — only while the certificate is valid. */
export async function GET(request: Request, { params }: RouteContext<"/v/[token]/preview.webp">) {
  if (!(await withinLimit("file", request.headers))) return new Response("Too many requests", { status: 429 });
  const cert = await findPublicByToken((await params).token);
  if (!cert?.documentAvailable) return new Response("Not found", { status: 404 });
  const image = await publicPreview(cert.id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      // Short and private: the page stops showing it as soon as the status changes.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
