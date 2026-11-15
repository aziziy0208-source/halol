import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { sampleHtml } from "@/app/admin/(panel)/certificates/template/sample";
import { ASSET_ORIGIN, renderPdf } from "@/certificates/renderer";
import { storage } from "@/lib/storage";

// Cold start: Chromium is unpacked first (serverless hosts).
export const maxDuration = 60;

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Operator self-check after a deployment: renders the sample certificate with headless
 * Chromium and writes/reads/deletes a test object in the private storage.
 * Only with `Authorization: Bearer <HEALTH_RENDER_TOKEN>`; without that variable the
 * route does not exist (404). `?pdf=1` returns the sample PDF (watermarked "MUSTER").
 */
export async function GET(request: Request) {
  await connection();
  const token = process.env.HEALTH_RENDER_TOKEN ?? "";
  if (token.length < 32) return new Response("Not found", { status: 404 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(digest(given), digest(token))) return new Response("Not found", { status: 404 });

  const started = Date.now();
  const result: Record<string, unknown> = {};
  try {
    const { pdf, pages } = await renderPdf(await sampleHtml("short", { assetBase: ASSET_ORIGIN, mode: "print" }));
    result.render = { status: "ok", pages, bytes: pdf.length, ms: Date.now() - started };
    if (new URL(request.url).searchParams.get("pdf") === "1") {
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  } catch (error) {
    result.render = { status: "error", message: error instanceof Error ? error.message : String(error) };
  }

  const storageStarted = Date.now();
  try {
    const key = "health/self-check.txt";
    const body = Buffer.from(`self-check ${new Date().toISOString()}`);
    await storage().put(key, body, "text/plain");
    const back = await storage().get(key);
    await storage().delete(key);
    result.storage = { status: back?.equals(body) ? "ok" : "mismatch", ms: Date.now() - storageStarted };
  } catch (error) {
    result.storage = { status: "error", message: error instanceof Error ? error.message : String(error) };
  }

  const ok = Object.values(result).every((r) => (r as { status: string }).status === "ok");
  return Response.json({ status: ok ? "ok" : "error", ...result }, { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
