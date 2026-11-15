// Node-only module (fs, Playwright): cannot end up in a client bundle.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium, type Page } from "playwright-core";

/**
 * Headless Chromium that turns certificate HTML into PDF and PNG.
 *
 * - One shared browser per server process, a fresh context per render. On serverless
 *   hosts (Vercel) a browser per render instead: a kept browser can be frozen between
 *   invocations, and the single-process Chromium there dies with its contexts.
 * - The page gets the HTML via setContent; its only network access is the
 *   template assets (fonts, logo) under ASSET_ORIGIN, served from public/certificate.
 *   Every other request is blocked, so output never depends on the network and
 *   the document cannot reach anything outside.
 * - At most MAX_PARALLEL renders run at the same time.
 */
import { configuredAppUrl } from "@/lib/env";
import { ASSET_ORIGIN } from "./assets";

export { ASSET_ORIGIN };
const ASSET_DIR = path.join(process.cwd(), "public", "certificate");
/**
 * Serverless Chromium (Vercel): @sparticuz/chromium-min downloads this pack to /tmp on a
 * cold start. Override with CHROMIUM_PACK_URL (e.g. a copy in your own storage) if needed.
 */
const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar";
const READY_TIMEOUT_MS = 20_000;
/** A4 at 96 dpi CSS pixels. */
const A4_PX = { width: 794, height: 1123 };

const MIME: Record<string, string> = {
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let browserPromise: Promise<Browser> | undefined;

/** Pack URL of the serverless Chromium, or "" for a normal Playwright Chromium. */
function serverlessPackUrl(): string {
  return process.env.CHROMIUM_PACK_URL || (process.env.VERCEL ? DEFAULT_CHROMIUM_PACK_URL : "");
}

async function launchBrowser(): Promise<Browser> {
  const packUrl = serverlessPackUrl();
  if (!packUrl) return chromium.launch({ headless: true });
  // Vercel functions run on Amazon Linux 2023; chromium-min detects that through this
  // variable (at import time) and then unpacks the system libraries Chromium needs.
  if (process.env.VERCEL) process.env.AWS_LAMBDA_JS_RUNTIME ??= `nodejs${process.versions.node.split(".")[0]}.x`;
  const { default: serverless } = await import("@sparticuz/chromium-min");
  return chromium.launch({ headless: true, args: serverless.args, executablePath: await serverless.executablePath(packUrl) });
}

/** Template asset from disk; on serverless hosts public/ may only exist on the CDN. */
async function readAsset(relative: string): Promise<Buffer | null> {
  const file = path.resolve(ASSET_DIR, relative);
  if (!file.startsWith(ASSET_DIR + path.sep)) return null;
  try {
    return await readFile(file);
  } catch {
    const base = configuredAppUrl()?.replace(/\/$/, "");
    if (!base) return null;
    const response = await fetch(`${base}/certificate/${relative.split("/").map(encodeURIComponent).join("/")}`, {
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    return response?.ok ? Buffer.from(await response.arrayBuffer()) : null;
  }
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().then((browser) => {
      browser.on("disconnected", () => {
        browserPromise = undefined;
      });
      return browser;
    });
    browserPromise.catch(() => {
      browserPromise = undefined;
    });
  }
  return browserPromise;
}

let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  const maxParallel = serverlessPackUrl() ? 1 : 2;
  if (running >= maxParallel) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** A fresh browser context (and on serverless hosts a fresh browser) for one task. */
async function withContext<T>(options: BrowserContextOptions, work: (context: BrowserContext) => Promise<T>): Promise<T> {
  return withSlot(async () => {
    const perTask = Boolean(serverlessPackUrl());
    const browser = perTask ? await launchBrowser() : await getBrowser();
    try {
      const context = await browser.newContext(options);
      try {
        return await work(context);
      } finally {
        await context.close().catch(() => undefined);
      }
    } finally {
      if (perTask) await browser.close().catch(() => undefined);
    }
  });
}

async function withCertificatePage<T>(html: string, scale: number, work: (page: Page) => Promise<T>): Promise<T> {
  return withContext({ viewport: A4_PX, deviceScaleFactor: scale }, async (context) => {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== ASSET_ORIGIN) return route.abort("blockedbyclient");
      const relative = decodeURIComponent(url.pathname).replace(/^\/certificate\//, "");
      const body = await readAsset(relative);
      if (!body) return route.abort("filenotfound");
      return route.fulfill({
        body,
        contentType: MIME[path.extname(relative)] ?? "application/octet-stream",
        headers: { "access-control-allow-origin": "*" },
      });
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-ready") === "1", null, {
      timeout: READY_TIMEOUT_MS,
    });
    return await work(page);
  });
}

export type RenderedPdf = { pdf: Buffer; pages: number };

/** HTML (mode "print", assetBase = ASSET_ORIGIN) → A4 PDF with embedded fonts. */
export async function renderPdf(html: string): Promise<RenderedPdf> {
  return withCertificatePage(html, 1, async (page) => {
    const pages = await page.locator(".page").count();
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      outline: false,
    });
    return { pdf: Buffer.from(pdf), pages };
  });
}

export type NormalizedImage = { png: Buffer; width: number; height: number };
type ImageType = "image/png" | "image/jpeg" | "image/svg+xml";

/**
 * Draws an image on a canvas in the sandboxed browser and re-encodes it.
 * `upscale` lets vector images (SVG) grow to `maxEdgePx`; bitmaps only shrink.
 * Returns null if the bytes are not a decodable image.
 */
async function reencodeImage(
  bytes: Buffer,
  type: ImageType,
  options: { maxEdgePx: number; output: "image/png" | "image/webp"; quality?: number; upscale: boolean },
): Promise<{ data: Buffer; width: number; height: number } | null> {
  return withContext({ javaScriptEnabled: true }, async (context) => {
    await context.route("**/*", (route) => route.abort("blockedbyclient"));
    const page = await context.newPage();
    const src = `data:${type};base64,${bytes.toString("base64")}`;
    // Code passed as a string: bundlers must not rewrite code that runs inside the page.
    const result = (await page.evaluate(`(async () => {
      try {
        const img = new Image();
        img.src = ${JSON.stringify(src)};
        await img.decode();
        let w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { w = 1200; h = 600; }
        const fit = ${options.maxEdgePx} / Math.max(w, h);
        const scale = ${JSON.stringify(options.upscale)} ? fit : Math.min(1, fit);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return { data: canvas.toDataURL(${JSON.stringify(options.output)}, ${options.quality ?? 0.85}), width: canvas.width, height: canvas.height };
      } catch (e) { return null; }
    })()`)) as { data: string; width: number; height: number } | null;
    if (!result || !result.data.startsWith(`data:${options.output};`)) return null;
    return { data: Buffer.from(result.data.split(",")[1] ?? "", "base64"), width: result.width, height: result.height };
  });
}

/**
 * Re-encodes an uploaded image (PNG, JPEG or SVG) as a fresh PNG: metadata,
 * scripts inside SVGs and polyglot payloads cannot survive this, and SVGs become
 * print-resolution bitmaps (spec §9: uploads restricted to PNG/JPG/SVG, SVG sanitised).
 */
export async function normalizeImage(bytes: Buffer, type: ImageType, maxEdgePx = 1600): Promise<NormalizedImage | null> {
  const result = await reencodeImage(bytes, type, { maxEdgePx, output: "image/png", upscale: type === "image/svg+xml" });
  return result ? { png: result.data, width: result.width, height: result.height } : null;
}

/** Smaller WebP rendition of a certificate preview PNG for the public page (mobile data). */
export async function previewWebp(png: Buffer, maxEdgePx = 1400): Promise<Buffer | null> {
  return (await reencodeImage(png, "image/png", { maxEdgePx, output: "image/webp", quality: 0.82, upscale: false }))?.data ?? null;
}

/** PNG of one page (default: the first). scale 2 ≈ 190 dpi, 2.5 ≈ 240 dpi. */
export async function renderPng(html: string, options: { scale?: number; pageIndex?: number } = {}): Promise<Buffer> {
  const scale = options.scale ?? 2;
  return withCertificatePage(html, scale, async (page) => {
    const target = page.locator(".page").nth(options.pageIndex ?? 0);
    return Buffer.from(await target.screenshot({ type: "png" }));
  });
}
