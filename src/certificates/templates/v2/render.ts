import type { CertificateDocument, RenderOptions } from "../../document";
import { TEXTS_V2 as T } from "./texts";

/**
 * Certificate template v2 — WHU's official certificate (WHU_Certificate_EN_2026.docx).
 * Pure function: document in, HTML out.
 *
 * Geometry is taken from the Word original (A4, margins 20.1 / 22.4 mm, Calibri
 * "single" line spacing = 1.2207 em; anchored images at their Word positions) and
 * checked against WHU's own PDF export. Carlito is metric-compatible with Calibri,
 * so lines break and fall exactly where Word puts them.
 *
 * Additions to the Word original, needed by the system: the verification QR code
 * (above the IHI logo, where the original has free space), annex pages for long
 * product lists, page numbers when there is an annex, draft/sample watermarks.
 *
 * The HTML contains a small script that (after the fonts have loaded) shrinks long
 * company names (18 pt → min. 12 pt, max. 2 lines), moves the product table to annex
 * pages if it does not fit page 1, writes page numbers, then sets data-ready="1".
 */

const BLUE = "#0a1fbf";
/** Calibri / Carlito single line spacing. */
const LH = 1.2207;
const mm = (pt: number) => (pt * 25.4) / 72;
const line = (pt: number) => `${(mm(pt) * LH).toFixed(3)}mm`;

const RANGES = {
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext":
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  cyrillic: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
  "cyrillic-ext": "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
} as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function suffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return [y, m, d];
}

/** "08<sup>th</sup> February 2026" — day with two digits, as in the original. */
function longDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}<sup>${suffix(d)}</sup> ${MONTHS[m - 1]} ${y}`;
}

/** "February 28<sup>th</sup> 2027" — the wording of the validity sentence. */
function monthDayYear(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = parts(iso);
  return `${MONTHS[m - 1]} ${d}<sup>${suffix(d)}</sup> ${y}`;
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function fontFaces(base: string): string {
  const faces: string[] = [];
  for (const weight of [400, 700]) {
    for (const [subset, range] of Object.entries(RANGES)) {
      faces.push(
        `@font-face{font-family:"Cert Carlito";src:url("${base}/certificate/fonts/carlito-${subset}-${weight}-normal.woff2") format("woff2");font-weight:${weight};font-style:normal;font-display:block;unicode-range:${range}}`,
      );
    }
  }
  return faces.join("\n");
}

const CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"Cert Carlito",sans-serif;color:#000;font-size:11pt;line-height:${LH};-webkit-print-color-adjust:exact;print-color-adjust:exact}
body.preview{background:#d4d7dd;padding:6mm 0}
p{margin:0}
sup{font-size:65%;line-height:0;vertical-align:.45em}
.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
.page:last-of-type{break-after:auto;page-break-after:auto}
body.preview .page{margin:0 auto 6mm;box-shadow:0 2px 14px rgba(0,0,0,.22)}
.bg{position:absolute;inset:0;width:210mm;height:297mm;z-index:0}
.draft-mark{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-32deg);font-weight:700;font-size:54pt;letter-spacing:2mm;color:rgba(190,0,0,.16);white-space:nowrap;z-index:6}
.flow{position:absolute;z-index:1;left:20.1mm;right:22.4mm;top:87.6mm;height:124.4mm;display:flex;flex-direction:column;text-align:center}
.t12{font-size:12pt;line-height:${line(12)}}
.t11{font-size:11pt;line-height:${line(11)}}
.b14{font-size:14pt;line-height:${line(14)};font-weight:700}
.name{font-size:18pt;line-height:${line(18)};font-weight:700;overflow-wrap:anywhere}
.gap2{height:${line(2)}}.gap3{height:${line(3)}}.gap4{height:${line(4)}}.gap8{height:${line(8)}}
.logo-gap{position:relative;height:15.94mm}
.logo-gap img{position:absolute;left:50%;top:-.24mm;width:32.67mm;height:16.07mm;transform:translateX(-50%);object-fit:contain}
.nologo-gap{height:${line(11)}}
.products{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.products-body{flex:1 1 auto;min-height:0;overflow:hidden}
.ptable{margin:0 auto;width:92.6mm;border-collapse:collapse;table-layout:fixed}
.ptable td{width:50%;height:4.97mm;padding:0 1.9mm;border:0;text-align:center;vertical-align:top;font-size:11pt;line-height:${line(11)};font-weight:700}
.ptable td .n{margin-right:1.6mm}
.ptable td .x{font-weight:400;font-size:9pt}
.annex-note{font-size:11pt;font-weight:700}
.bottom{position:absolute;z-index:1;left:20.1mm;right:22.4mm;top:214.1mm;font-size:11pt;line-height:${line(11)}}
.bottom .validity{text-align:center}
.bottom .kv{padding-left:7.5mm;display:flex}
.bottom .kv .k{width:42.4mm;flex:none}
.bottom .left{padding-left:7.5mm}
.e11{height:${line(11)}}
.sig{position:absolute;z-index:2;left:32.4mm;top:245.1mm;width:37mm;height:20.8mm;object-fit:contain;object-position:left center}
.ihi{position:absolute;z-index:1;left:104.3mm;top:251.1mm;width:34.43mm;height:18.91mm}
.seal{position:absolute;z-index:1;left:148.3mm;top:235.9mm;width:37.22mm;height:37.25mm}
.qr{position:absolute;z-index:2;background:#fff}
.qr svg{display:block;width:100%;height:100%}
.qr-pending{position:absolute;z-index:2;left:109mm;top:221.5mm;width:25mm;height:25mm;border:.3mm dashed #8a94a6;display:flex;align-items:center;justify-content:center;text-align:center;font-size:7pt;line-height:1.25;color:#5b6472;padding:2mm;background:rgba(255,255,255,.85)}
.page-no{position:absolute;z-index:2;left:0;right:0;top:271.4mm;text-align:center;font-size:8pt;color:#333}
.annex-flow{position:absolute;z-index:1;left:20.1mm;right:22.4mm;top:87.6mm;height:180mm;display:flex;flex-direction:column;text-align:center}
.annex-title{font-size:14pt;line-height:${line(14)};font-weight:700;color:${BLUE}}
`;

function companyLines(doc: CertificateDocument): { name: string; address: string } {
  const c = doc.company;
  const name = c.legalForm && !c.name.toLowerCase().includes(c.legalForm.toLowerCase()) ? `${c.name} ${c.legalForm}` : c.name;
  const place = [c.postalCode, c.city].filter(Boolean).join(" ");
  return { name, address: [c.address, place, countryName(c.country)].filter(Boolean).join(", ") };
}

function productRows(doc: CertificateDocument): string {
  const label = (p: CertificateDocument["products"][number]) =>
    `${esc(p.name)}${p.brand || p.articleNo ? ` <span class="x">(${esc([p.brand, p.articleNo].filter(Boolean).join(", "))})</span>` : ""}`;
  // A single product: one full-width cell, centred and without a number, as in the Word original.
  if (doc.products.length === 1) return `<tr><td colspan="2">${label(doc.products[0]!)}</td></tr>`;
  // Several products: numbered, two per row, each name centred in its cell.
  const cells = doc.products.map((p, i) => `<td><span class="n">${i + 1}.</span>${label(p)}</td>`);
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? "<td></td>"}</tr>`);
  return rows.join("");
}

function qr(doc: CertificateDocument): string {
  const v = doc.verification;
  if (!v) return `<div class="qr-pending">${esc(T.qrPending)}</div>`;
  // The SVG carries a 4-module quiet zone; the code itself is printed 25 mm wide,
  // centred above the IHI logo (x 121.5 mm), code area y 221.5–246.5 mm.
  const ratio = v.qrSizeMm / 26; // (modules + 8) / modules, see qr.ts
  const box = 25 * ratio;
  const left = 121.5 - box / 2;
  const top = 234 - box / 2;
  return `<div class="qr" style="left:${left.toFixed(2)}mm;top:${top.toFixed(2)}mm;width:${box.toFixed(2)}mm;height:${box.toFixed(2)}mm" title="${esc(T.verifyCaption)}: ${esc(v.displayUrl)}">${v.qrSvg}</div>`;
}

function mark(doc: CertificateDocument): string {
  const text = doc.watermark === "draft" ? T.draftMark : doc.watermark === "sample" ? T.sampleMark : null;
  return text ? `<div class="draft-mark">${esc(text)}</div>` : "";
}

export function renderCertificateV2(doc: CertificateDocument, options: RenderOptions): string {
  const a = options.assetBase.replace(/\/$/, "");
  const bg = `<img class="bg" src="${a}/certificate/v2/background.png" alt="">`;
  const { name, address } = companyLines(doc);
  const codes = doc.standards.map((s) => s.code).join(", ") || "—";
  const number = doc.certificateNumber
    ? `${esc(doc.certificateNumber)}${doc.revision > 0 ? ` (Rev. ${doc.revision})` : ""}`
    : esc(T.draftNumber);

  const products = doc.products.length
    ? `<section class="products"><p class="t11">${esc(T.productsList)}</p><div class="products-body"><table class="ptable"><tbody>${productRows(doc)}</tbody></table></div></section>`
    : "";

  const flow = `<div class="flow">
<p class="t12">${esc(T.intro)}</p>
<p class="t12">${esc(T.confirms)}</p>
${doc.images.companyLogo ? `<div class="logo-gap"><img src="${esc(doc.images.companyLogo)}" alt=""></div>` : `<div class="nologo-gap"></div>`}
<p class="name" data-autoshrink="18,12,2">${esc(name)}</p>
<p class="b14">${esc(address)}</p>
${doc.productionSite ? `<p class="t11">${esc(T.productionSite)} ${esc(doc.productionSite)}</p>` : ""}
<div class="gap2"></div>
<p class="t12">${esc(T.meets)}</p>
<p class="b14">${esc(codes)} ${esc(T.standardsSuffix)}</p>
<div class="gap2"></div>
<p class="t12">${esc(T.scopeIntro)}</p>
<p class="b14">${esc(doc.scope)}</p>
<div class="gap4"></div>
${T.statement.map((s) => `<p class="t11">${esc(s)}</p>`).join("")}
<p class="t11">${esc(T.guidelines(codes))}</p>
<div class="gap8"></div>
${products}
</div>`;

  const bottom = `<div class="bottom">
<p class="validity">${esc(T.validity.before)} ${monthDayYear(doc.validUntil)} ${esc(T.validity.after)}</p>
<div class="gap8"></div>
<div class="kv"><span class="k">${esc(T.number)}</span><span>${number}</span></div>
<div class="e11"></div>
<div class="kv"><span class="k">${esc(T.validFrom)}</span><span>${longDate(doc.issueDate)}</span></div>
<div class="kv"><span class="k">${esc(T.validUntil)}</span><span>${longDate(doc.validUntil)}</span></div>
<div class="gap8"></div>
<p class="left">${esc(T.place)}, ${longDate(doc.issueDate)}</p>
<div class="e11"></div><div class="e11"></div>
${T.issuer.map((l) => `<p class="left">${esc(l)}</p>`).join("")}
</div>`;

  const mainPage = `<div class="page page-main">${bg}${flow}${bottom}
${doc.images.signature ? `<img class="sig" src="${esc(doc.images.signature)}" alt="">` : ""}
<img class="ihi" src="${a}/certificate/v2/ihi-alliance.png" alt="Member of International Halal Integrity Alliance">
<img class="seal" src="${a}/certificate/v2/halal-seal.png" alt="World Halal Union – Halal Certification">
${qr(doc)}<p class="page-no"></p>${mark(doc)}</div>`;

  const annexTemplate = `<template id="annex-page"><div class="page page-annex">${bg}<div class="annex-flow">
<p class="annex-title">${esc(T.annexTitle)}</p>
<p class="t11">${esc(T.number)} ${number} · ${esc(name)}</p>
<div class="gap8"></div>
<section class="products"><div class="products-body"><table class="ptable"><tbody></tbody></table></div></section>
</div><p class="page-no"></p>${mark(doc)}</div></template>`;

  const annexNotice = `<template id="annex-notice"><p class="annex-note">${esc(T.productsInAnnex(doc.products.length))}</p></template>`;

  // Static script (no document data inside): layout steps that need real text measurement.
  const script = `(async function(){
var done=function(){document.documentElement.setAttribute("data-ready","1");window.__certReady=true;};
try{
if(document.fonts&&document.fonts.ready){await document.fonts.ready;}
await Promise.all(Array.prototype.map.call(document.images,function(img){return img.complete?null:new Promise(function(r){img.onload=img.onerror=r;});}));
await new Promise(function(resolve){var first=document.querySelector(".page");var check=function(){if(!first||first.getBoundingClientRect().height>0){resolve();}else{setTimeout(check,100);}};check();});
document.querySelectorAll("[data-autoshrink]").forEach(function(el){
var p=el.getAttribute("data-autoshrink").split(",").map(Number),size=p[0],min=p[1],lines=p[2];
var fits=function(){return el.getBoundingClientRect().height<=size*${LH}*lines*96/72+1;};
var set=function(){el.style.fontSize=size+"pt";el.style.lineHeight=(size*${LH})+"pt";};
set();
while(!fits()&&size>min){size=Math.round((size-0.5)*10)/10;set();}
});
var main=document.querySelector(".page-main"),body=main&&main.querySelector(".products-body"),tpl=document.getElementById("annex-page");
if(body&&tpl&&body.scrollHeight>body.clientHeight+1){
var rows=Array.prototype.slice.call(body.querySelectorAll("tbody tr"));
body.innerHTML=document.getElementById("annex-notice").innerHTML;
var pbody,tbody;
var addPage=function(){document.body.appendChild(tpl.content.cloneNode(true));var pg=document.body.lastElementChild;pbody=pg.querySelector(".products-body");tbody=pg.querySelector("tbody");};
addPage();
rows.forEach(function(row){tbody.appendChild(row);if(pbody.scrollHeight>pbody.clientHeight+1&&tbody.rows.length>1){tbody.removeChild(row);addPage();tbody.appendChild(row);}});
}
var pages=document.querySelectorAll(".page");
if(pages.length>1){pages.forEach(function(pg,i){var n=pg.querySelector(".page-no");if(n){n.textContent=${JSON.stringify(T.page(7, 9))}.replace("7",String(i+1)).replace("9",String(pages.length));}});}
if(document.body.classList.contains("preview")){var fit=function(){var w=document.querySelector(".page").offsetWidth;document.body.style.zoom=String(Math.min(1,(window.innerWidth-24)/w));};fit();window.addEventListener("resize",fit);}
}finally{done();}
})();`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate ${esc(doc.certificateNumber ?? "")}</title><style>${fontFaces(a)}${CSS}</style></head><body class="${options.mode}">${mainPage}${annexTemplate}${annexNotice}<script>${script}</script></body></html>`;
}
