/**
 * Certificate templates + renderer (no database): PDF format and fonts, QR
 * decodability, annex pagination, name shrinking, escaping.
 * v1 = provisional design (stage 5, still used by certificates issued with it),
 * v2 = WHU's official design (current).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import type { CertificateDocument } from "@/certificates/document";
import { displayUrl, qrCodeSvg, verificationUrl } from "@/certificates/qr";
import { ASSET_ORIGIN, renderPdf, renderPng } from "@/certificates/renderer";
import { sampleDocument } from "@/certificates/sample";
import { renderCertificateHtml } from "@/certificates/templates";
import { check, decodeQr } from "./helpers";

test("certificate template v1 (provisional design): A4 PDF, fonts, QR, annex pages, escaping", async ({ browser }) => {
  const url = verificationUrl("https://halal-zertifizierung.de", "Ab3dEf9hJk2mNp4q");
  const qr = await qrCodeSvg(url);
  const verification = { url, displayUrl: displayUrl(url), qrSvg: qr.svg, qrSizeMm: qr.sizeMm };
  const html = (doc: CertificateDocument) => renderCertificateHtml(1, doc, { assetBase: ASSET_ORIGIN, mode: "print" });

  // ── QR geometry ──
  const codeMm = (qr.sizeMm * qr.modules) / (qr.modules + 8);
  check(codeMm >= 25, `QR code edge ${codeMm.toFixed(1)} mm ≥ 25 mm (+ quiet zone → ${qr.sizeMm} mm)`);
  check(qr.svg.includes("<svg") && !qr.svg.includes("<image"), "QR is pure vector SVG");

  // ── PDF ──
  const short = sampleDocument("short", verification);
  const { pdf, pages } = await renderPdf(html(short));
  const text = pdf.toString("latin1");
  const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const w = box ? Number(box[1]) : 0;
  const h = box ? Number(box[2]) : 0;
  check(Math.abs(w - 595.3) < 1.5 && Math.abs(h - 841.9) < 1.5, `PDF page is A4 (${w} × ${h} pt)`);
  check(pages === 1 && (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length === 1, "short certificate = 1 page");
  const fonts = ["NotoSans", "NotoSerif", "NotoNaskhArabic"].filter((f) => text.includes(f));
  check(fonts.length === 3 && /\/FontFile2/.test(text), `fonts embedded in the PDF (${fonts.join(", ")})`);
  check(!/\/Subtype\s*\/Image[\s\S]{0,200}\/Width\s+(?:7[0-9]{2}|[89][0-9]{2}|[1-9][0-9]{3})\s/.test(text), "certificate text is not a page-sized raster image");

  // ── QR decodes from the rendered certificate, also at low resolution ──
  for (const scale of [2, 1]) {
    const decoded = decodeQr(await renderPng(html(short), { scale }));
    check(decoded === url, `QR decodes to the verification URL at ${Math.round(96 * scale)} dpi (${decoded ?? "nothing"})`);
  }

  // ── Annex pagination, nothing lost ──
  const context = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== ASSET_ORIGIN) return route.abort();
    const file = path.join(process.cwd(), "public", decodeURIComponent(u.pathname));
    return route.fulfill({
      body: readFileSync(file),
      contentType: file.endsWith(".png") ? "image/png" : "font/woff2",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  const page = await context.newPage();
  const layout = async (doc: CertificateDocument) => {
    await page.setContent(html(doc));
    await page.waitForFunction("document.documentElement.dataset.ready === '1'");
    return page.evaluate(`(() => {
      const pages = [...document.querySelectorAll('.page')];
      const numbers = [...document.querySelectorAll('.ptable tbody td.n')].map((td) => Number(td.textContent));
      const overflow = pages.some((p) => { const b = p.querySelector('.products-body'); return b && b.scrollHeight > b.clientHeight + 1; });
      const name = document.querySelector('.company-name');
      return { pages: pages.length, numbers, overflow, labels: pages.map((p) => p.querySelector('.page-no').textContent),
               nameSize: Math.round(parseFloat(getComputedStyle(name).fontSize) * 72 / 96 * 10) / 10, scripts: document.querySelectorAll('script').length,
               injectedImg: document.querySelectorAll('img[onerror]').length, bodyText: document.body.innerText };
    })()`) as Promise<{ pages: number; numbers: number[]; overflow: boolean; labels: string[]; nameSize: number; scripts: number; injectedImg: number; bodyText: string }>;
  };

  const base = sampleDocument("short", verification);
  const productsOf = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `Produkt ${i + 1} Äöüß`, brand: "Marke", articleNo: `A-${i + 1}`, description: i % 5 === 0 ? "Beschreibung mit zweiter Zeile" : null }));
  let lastPages = 0;
  for (const n of [0, 5, 12, 14, 16, 30, 60, 120, 200]) {
    const r = await layout({ ...base, products: productsOf(n) });
    const complete = r.numbers.length === n && r.numbers.every((v, i) => v === i + 1);
    check(complete && !r.overflow && r.pages >= lastPages, `${n} products → ${r.pages} page(s), all rows present in order, nothing cut off`);
    check(r.labels.every((l, i) => l === `Seite ${i + 1} von ${r.pages} · Page ${i + 1} of ${r.pages}`), `   page labels: ${r.labels.length ? `${r.labels[0]} … ${r.labels.at(-1)}` : "-"}`);
    lastPages = r.pages;
  }

  // ── Company name shrinking ──
  const longName = await layout(sampleDocument("long", verification));
  check(longName.nameSize < 20 && longName.nameSize >= 13, `long company name shrinks to ${longName.nameSize} pt (20 → ≥ 13)`);
  const huge = await layout({ ...base, company: { ...base.company, name: "Sehr ".repeat(80) + "Lange Firma GmbH" } });
  check(huge.nameSize === 13 && !huge.overflow, `extreme name stops at the 13 pt minimum (${huge.nameSize} pt) and nothing overflows`);

  // ── Escaping ──
  const evil = await layout({
    ...base,
    company: { ...base.company, name: `Evil "Corp" <b>bold</b>` },
    products: [{ name: `<script>window.__pwned=1</script>`, brand: `"><img src=x onerror="window.__pwned=2">`, articleNo: "&amp;", description: null }],
  });
  const pwned = await page.evaluate("window.__pwned === undefined");
  check(evil.scripts === 1 && evil.injectedImg === 0 && pwned === true, "HTML in data is shown as text, never executed");
  check(evil.bodyText.includes("<script>window.__pwned=1</script>") && evil.bodyText.includes('Evil "Corp" <b>bold</b>'), "special characters are displayed literally");

});

test("certificate template v2 (official WHU design): A4, Carlito, QR, annex pages, escaping", async ({ browser }) => {
  const url = verificationUrl("https://halal-zertifizierung.de", "Ab3dEf9hJk2mNp4q");
  const qr = await qrCodeSvg(url);
  const verification = { url, displayUrl: displayUrl(url), qrSvg: qr.svg, qrSizeMm: qr.sizeMm };
  const html = (doc: CertificateDocument) => renderCertificateHtml(2, doc, { assetBase: ASSET_ORIGIN, mode: "print" });

  // ── PDF ──
  const short = sampleDocument("short", verification);
  const { pdf, pages } = await renderPdf(html(short));
  const text = pdf.toString("latin1");
  const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const w = box ? Number(box[1]) : 0;
  const h = box ? Number(box[2]) : 0;
  check(Math.abs(w - 595.3) < 1.5 && Math.abs(h - 841.9) < 1.5, `v2: PDF page is A4 (${w} × ${h} pt)`);
  check(pages === 1, "v2: short certificate = 1 page");
  check(text.includes("Carlito") && /\/FontFile2/.test(text), "v2: Carlito (Calibri-compatible) embedded, text stays text");
  check(/\/Subtype\s*\/Image/.test(text), "v2: official background artwork embedded");

  // ── QR decodes from the rendered certificate, also at 96 dpi ──
  for (const scale of [2, 1]) {
    const decoded = decodeQr(await renderPng(html(short), { scale }));
    check(decoded === url, `v2: QR decodes to the verification URL at ${Math.round(96 * scale)} dpi (${decoded ?? "nothing"})`);
  }

  // ── Layout in a browser page ──
  const context = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== ASSET_ORIGIN) return route.abort();
    const file = path.join(process.cwd(), "public", decodeURIComponent(u.pathname));
    return route.fulfill({
      body: readFileSync(file),
      contentType: file.endsWith(".png") ? "image/png" : "font/woff2",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  const page = await context.newPage();
  const layout = async (doc: CertificateDocument) => {
    await page.setContent(html(doc));
    await page.waitForFunction("document.documentElement.dataset.ready === '1'");
    return page.evaluate(`(() => {
      const pages = [...document.querySelectorAll('.page')];
      const numbers = [...document.querySelectorAll('.ptable td .n')].map((n) => parseInt(n.textContent, 10));
      const overflow = pages.some((p) => { const b = p.querySelector('.products-body'); return b && b.scrollHeight > b.clientHeight + 1; });
      const name = document.querySelector('.name');
      const nr = [...document.querySelectorAll('.bottom .kv .k')].find((k) => k.textContent === 'Certificate Nr.');
      const mm = (px) => Math.round(px / 96 * 25.4 * 10) / 10;
      return { pages: pages.length, numbers, overflow, labels: pages.map((p) => p.querySelector('.page-no').textContent),
               nameSize: Math.round(parseFloat(getComputedStyle(name).fontSize) * 72 / 96 * 10) / 10,
               nrLeft: nr ? mm(nr.getBoundingClientRect().left) : 0,
               scripts: document.querySelectorAll('script').length, injectedImg: document.querySelectorAll('img[onerror]').length,
               bodyText: document.body.innerText };
    })()`) as Promise<{ pages: number; numbers: number[]; overflow: boolean; labels: string[]; nameSize: number; nrLeft: number; scripts: number; injectedImg: number; bodyText: string }>;
  };

  const base = sampleDocument("short", verification);
  const productsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Produkt ${i + 1} Äöüß ЦИНК+`, brand: null, articleNo: null, description: null }));
  let lastPages = 0;
  for (const n of [0, 6, 12, 14, 30, 120]) {
    const r = await layout({ ...base, products: productsOf(n) });
    const complete = r.numbers.length === n && r.numbers.every((v, i) => v === i + 1);
    check(complete && !r.overflow && r.pages >= lastPages, `v2: ${n} products → ${r.pages} page(s), all rows present in order, nothing cut off`);
    check(
      r.pages === 1 ? r.labels.every((l) => l === "") : r.labels.every((l, i) => l === `Page ${i + 1} of ${r.pages}`),
      `v2: page labels ${r.pages > 1 ? `${r.labels[0]} … ${r.labels.at(-1)}` : "(single page: none)"}`,
    );
    lastPages = r.pages;
  }
  const first = await layout(base);
  check(Math.abs(first.nrLeft - 27.6) < 0.3, `v2: "Certificate Nr." at the original position (${first.nrLeft} mm from the left edge)`);
  check(first.bodyText.includes("guidelines OIC/SMIIC 1:2019 and respectively CAC/GL 24-1997."), "v2: standards in the guidelines sentence");

  // ── Company name shrinking ──
  const longName = await layout(sampleDocument("long", verification));
  check(longName.nameSize < 18 && longName.nameSize >= 12, `v2: long company name shrinks to ${longName.nameSize} pt (18 → ≥ 12)`);

  // ── Escaping ──
  const evil = await layout({
    ...base,
    company: { ...base.company, name: `Evil "Corp" <b>bold</b>` },
    products: [{ name: `<script>window.__pwned=1</script>`, brand: `"><img src=x onerror="window.__pwned=2">`, articleNo: "&amp;", description: null }],
  });
  const pwned = await page.evaluate("window.__pwned === undefined");
  check(evil.scripts === 1 && evil.injectedImg === 0 && pwned === true, "v2: HTML in data is shown as text, never executed");
  check(evil.bodyText.includes("<script>window.__pwned=1</script>") && evil.bodyText.includes('Evil "Corp" <b>bold</b>'), "v2: special characters are displayed literally");
  await context.close();
});
