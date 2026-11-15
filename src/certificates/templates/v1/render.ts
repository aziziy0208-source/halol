import type { CertificateDocument, RenderOptions } from "../../document";
import { TEXTS_V1 as T } from "./texts";

/**
 * Certificate template v1 — A4 portrait, German/English, PROVISIONAL design until
 * WHU's official template is available. Pure function: document in, HTML out.
 *
 * The HTML contains a small script that (after the fonts have loaded)
 *   1. shrinks long company names (20 pt → min. 13 pt, max. 2 lines),
 *   2. moves the product list to "Anlage / Annex" pages if it does not fit page 1,
 *   3. writes "Seite x von n" page numbers,
 * then sets data-ready="1" on <html>. Preview, PDF and PNG all wait for that flag.
 * Measuring waits until the page is actually laid out: a preview iframe that loads
 * while hidden (display:none, e.g. during streaming) would otherwise measure zero sizes.
 */
export const TEMPLATE_V1_PAGE_MM = { width: 210, height: 297 } as const;

const NAVY = "#1b2a6b";
const BLUE = "#0077a3";
const GOLD = "#a9844a";
const INK = "#1f2937";
const MUTED = "#5b6472";

const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Deutsch Englisch" label: German regular, English muted italic. */
function bi(pair: readonly string[]): string {
  return `<span class="de">${esc(pair[0] ?? "")}</span> <span class="en">${esc(pair[1] ?? "")}</span>`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function countryName(code: string): string {
  try {
    const de = new Intl.DisplayNames(["de"], { type: "region" }).of(code) ?? code;
    const en = new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
    return de === en ? de : `${de} / ${en}`;
  } catch {
    return code;
  }
}

function fontFaces(base: string): string {
  const url = (file: string) => `url("${base}/certificate/fonts/${file}.woff2") format("woff2")`;
  const faces: string[] = [];
  for (const [family, prefix, weights] of [
    ["Cert Sans", "noto-sans", [400, 600, 700]],
    ["Cert Serif", "noto-serif", [400, 700]],
  ] as const) {
    for (const weight of weights) {
      faces.push(
        `@font-face{font-family:"${family}";src:${url(`${prefix}-latin-${weight}-normal`)};font-weight:${weight};font-style:normal;font-display:block;unicode-range:${LATIN}}`,
        `@font-face{font-family:"${family}";src:${url(`${prefix}-latin-ext-${weight}-normal`)};font-weight:${weight};font-style:normal;font-display:block;unicode-range:${LATIN_EXT}}`,
      );
    }
  }
  for (const weight of [400, 700]) {
    faces.push(
      `@font-face{font-family:"Cert Arabic";src:${url(`noto-naskh-arabic-arabic-${weight}-normal`)};font-weight:${weight};font-style:normal;font-display:block}`,
    );
  }
  return faces.join("\n");
}

const CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"Cert Sans",sans-serif;color:${INK};font-size:9pt;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body.preview{background:#d4d7dd;padding:6mm 0}
.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
.page:last-of-type{break-after:auto;page-break-after:auto}
body.preview .page{margin:0 auto 6mm;box-shadow:0 2px 14px rgba(0,0,0,.22)}
.frame-outer{position:absolute;inset:6mm;border:.8mm solid ${NAVY}}
.frame-inner{position:absolute;inset:8.2mm;border:.25mm solid ${GOLD}}
.corner{position:absolute;width:15mm;height:15mm}
.corner.tl{top:9.6mm;left:9.6mm}.corner.tr{top:9.6mm;right:9.6mm;transform:scaleX(-1)}
.corner.bl{bottom:9.6mm;left:9.6mm;transform:scaleY(-1)}.corner.br{bottom:9.6mm;right:9.6mm;transform:scale(-1,-1)}
.watermark{position:absolute;left:50%;top:54%;width:150mm;height:150mm;transform:translate(-50%,-50%);opacity:.045}
.draft-mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-32deg);font-weight:700;font-size:52pt;letter-spacing:2mm;color:rgba(190,0,0,.15);white-space:nowrap;z-index:5}
.content{position:absolute;top:14mm;bottom:12mm;left:19mm;right:19mm;display:flex;flex-direction:column}
.en{color:${MUTED};font-style:italic}
.head{text-align:center}
.logo{height:17mm;width:auto}
.org{margin-top:1.4mm;font-weight:600;font-size:8.5pt;letter-spacing:.35em;color:${NAVY}}
.org-sub{font-size:7pt;color:${MUTED};letter-spacing:.03em}
.title{text-align:center;margin-top:4.5mm}
h1{margin:0;font-family:"Cert Serif",serif;font-weight:700;font-size:25pt;letter-spacing:.06em;color:${NAVY};line-height:1.1}
.title-en{font-weight:600;font-size:9.5pt;letter-spacing:.4em;color:${BLUE};margin-top:1mm}
.title-ar{font-family:"Cert Arabic",serif;font-weight:700;font-size:15pt;color:${GOLD};line-height:1.35}
.number{margin-top:3.5mm;text-align:center;font-size:8.5pt}
.number .val{display:inline-block;margin-left:2mm;padding:.8mm 3mm;border:.3mm solid ${GOLD};border-radius:1mm;font-weight:700;font-size:11pt;letter-spacing:.05em;color:${NAVY};font-style:normal}
.number .rev{font-weight:600;color:${MUTED};margin-left:1.2mm;font-size:9pt}
.lead{text-align:center;margin:4mm 0 1.3mm;font-size:8.8pt}
.company{text-align:center}
.company-name{font-family:"Cert Serif",serif;font-weight:700;color:${INK};line-height:1.18;font-size:20pt;overflow-wrap:anywhere}
.company-address{margin-top:1mm;font-size:9pt;color:#374151}
.standards{list-style:none;margin:0;padding:0;text-align:center;font-size:9pt}
.standards li{margin:.4mm 0}
.kv-grid{margin-top:3.5mm;display:grid;grid-template-columns:38mm 1fr;gap:1.2mm 4mm;font-size:8.8pt}
.kv-grid .k{color:${MUTED};font-size:8pt}.kv-grid .k .de{color:${INK};font-weight:600}
.products{margin-top:3.5mm;flex:1 1 auto;min-height:18mm;display:flex;flex-direction:column}
.section-title{margin:0 0 1.2mm;font-size:8pt;font-weight:600;color:${NAVY};letter-spacing:.08em;text-transform:uppercase;border-bottom:.3mm solid ${GOLD};padding-bottom:.8mm}
.section-title .en{text-transform:none;letter-spacing:0;font-weight:400}
.products-body{flex:1 1 auto;min-height:0;overflow:hidden}
.ptable{width:100%;border-collapse:collapse;font-size:8.2pt}
.ptable th{text-align:left;font-weight:600;color:${MUTED};font-size:7pt;padding:.6mm 1.5mm;border-bottom:.2mm solid #c8ccd3}
.ptable th .en{font-weight:400}
.ptable td{padding:.85mm 1.5mm;border-bottom:.15mm solid #e5e7eb;vertical-align:top}
.ptable .n{width:8mm;color:${MUTED};font-variant-numeric:tabular-nums}
.ptable .b{width:38mm}.ptable .a{width:30mm;font-variant-numeric:tabular-nums}
.ptable .d{display:block;color:${MUTED};font-size:7pt}
.notice{font-size:8.8pt;padding:2mm 0;margin:0}
.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:3mm}
.date{border:.25mm solid #c8ccd3;border-radius:1mm;padding:1.5mm 2.5mm}
.date .k{font-size:7pt;color:${MUTED}}.date .k .de{color:${INK};font-weight:600}
.date .v{font-size:11pt;font-weight:700;color:${NAVY};font-variant-numeric:tabular-nums}
.bottom{display:flex;align-items:flex-end;justify-content:space-between;gap:6mm;margin-top:4mm;height:44mm}
.qr-block{display:flex;align-items:flex-end;gap:3mm}
.qr svg{display:block;width:100%;height:100%}
.qr-text{font-size:7pt;line-height:1.35;max-width:62mm;padding-bottom:1.5mm}
.qr-text .url{display:block;font-weight:600;color:${INK};white-space:nowrap;font-size:6.8pt;margin-top:.8mm}
.qr-text .num{display:block;font-weight:700;color:${NAVY};font-size:8pt;margin-top:.6mm}
.qr-placeholder{width:31mm;height:31mm;border:.3mm dashed #9ca3af;display:flex;align-items:center;justify-content:center;text-align:center;font-size:6.5pt;color:${MUTED};padding:2mm}
.sign-block{width:76mm;text-align:center}
.sign-place{font-size:8.5pt;margin-bottom:1mm}
.sign-area{position:relative;height:23mm}
.sign-area .stamp{position:absolute;left:50%;top:50%;max-height:25mm;max-width:30mm;transform:translate(-85%,-50%);opacity:.92}
.sign-area .signature{position:absolute;left:50%;bottom:.5mm;max-height:16mm;max-width:46mm;transform:translateX(-35%)}
.sign-line{border-top:.25mm solid ${INK};margin:0 3mm}
.sign-name{font-weight:600;font-size:9pt;margin-top:.8mm}
.sign-title{font-size:7.2pt;color:${MUTED}}
.foot{margin-top:3mm;text-align:center;font-size:6.2pt;color:${MUTED};line-height:1.35}
.foot p{margin:0}.foot .addr{margin-top:.6mm}.foot .page-no{margin-top:.8mm;font-variant-numeric:tabular-nums}
.annex-head{display:flex;align-items:center;gap:5mm;border-bottom:.3mm solid ${GOLD};padding-bottom:3mm}
.logo-sm{height:11mm;width:auto}
.annex-title{font-family:"Cert Serif",serif;font-weight:700;font-size:14pt;color:${NAVY};line-height:1.2}
.annex-title .en{font-family:"Cert Sans",sans-serif;font-size:9pt;font-weight:400}
.annex-meta{font-size:8.5pt;margin-top:.8mm}
.annex-meta b{color:${NAVY}}
.page-annex .products{margin-top:5mm}
`;

const CORNER = `<g fill="none" stroke="${GOLD}"><path d="M1 59V1H59" stroke-width="1.6"/><path d="M7 45V7H45" stroke-width=".7"/><g transform="translate(19 19)" stroke-width="1.1"><rect x="-7" y="-7" width="14" height="14"/><rect x="-7" y="-7" width="14" height="14" transform="rotate(45)"/><circle r="3.4"/></g></g>`;

const WATERMARK = (() => {
  const squares = Array.from({ length: 6 }, (_, i) => `<rect x="-60" y="-60" width="120" height="120" transform="rotate(${i * 15})"/>`).join("");
  return `<svg class="watermark" viewBox="-100 -100 200 200" aria-hidden="true"><g fill="none" stroke="${NAVY}" stroke-width="1.2">${squares}<circle r="84"/><circle r="40"/><circle r="94" stroke-width=".6"/></g></svg>`;
})();

function decoration(watermark: CertificateDocument["watermark"]): string {
  const corners = ["tl", "tr", "bl", "br"]
    .map((c) => `<svg class="corner ${c}" viewBox="0 0 60 60" aria-hidden="true">${CORNER}</svg>`)
    .join("");
  const mark = watermark === "draft" ? T.draftMark : watermark === "sample" ? T.sampleMark : null;
  return `${WATERMARK}<div class="frame-outer"></div><div class="frame-inner"></div>${corners}${
    mark ? `<div class="draft-mark">${esc(mark)}</div>` : ""
  }`;
}

function footer(): string {
  return `<footer class="foot"><p class="validity">${esc(T.validityNote)}</p><p class="addr">${esc(T.footer)}</p><p class="page-no"></p></footer>`;
}

function productTable(doc: CertificateDocument, withRows: boolean): string {
  const rows = withRows
    ? doc.products
        .map(
          (p, i) =>
            `<tr><td class="n">${i + 1}</td><td>${esc(p.name)}${p.description ? `<span class="d">${esc(p.description)}</span>` : ""}</td><td class="b">${esc(p.brand ?? "—")}</td><td class="a">${esc(p.articleNo ?? "—")}</td></tr>`,
        )
        .join("")
    : "";
  return `<table class="ptable"><thead><tr><th class="n">#</th><th>${bi(T.colProduct)}</th><th class="b">${bi(T.colBrand)}</th><th class="a">${bi(T.colArticle)}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderCertificateV1(doc: CertificateDocument, options: RenderOptions): string {
  const a = options.assetBase.replace(/\/$/, "");
  const number = doc.certificateNumber;
  const numberHtml = number
    ? `<span class="val">${esc(number)}</span>${doc.revision > 0 ? `<span class="rev">Rev. ${doc.revision}</span>` : ""}`
    : `<span class="val">${esc(T.draftNumber)}</span>`;
  const c = doc.company;
  const addressLine = [c.address, [c.postalCode, c.city].filter(Boolean).join(" "), countryName(c.country)]
    .filter(Boolean)
    .map(esc)
    .join(" · ");

  const kv: string[] = [];
  if (doc.productionSite) kv.push(`<div class="k">${bi(T.productionSite)}</div><div class="v">${esc(doc.productionSite)}</div>`);
  kv.push(`<div class="k">${bi(T.scope)}</div><div class="v">${esc(doc.scope)}</div>`);
  if (doc.category) kv.push(`<div class="k">${bi(T.category)}</div><div class="v">${esc(doc.category)}</div>`);

  const v = doc.verification;
  const qrBlock = v
    ? `<div class="qr-block"><div class="qr" style="width:${v.qrSizeMm}mm;height:${v.qrSizeMm}mm">${v.qrSvg}</div><div class="qr-text">${bi(T.verify)}<span class="url">${esc(v.displayUrl)}</span><span class="num">${esc(number ?? "")}${doc.revision > 0 ? ` · Rev. ${doc.revision}` : ""}</span></div></div>`
    : `<div class="qr-block"><div class="qr-placeholder"><div>${bi(T.qrPending)}</div></div></div>`;

  const s = doc.signatory;
  const signBlock = `<div class="sign-block"><div class="sign-place">${esc(T.place)}, ${esc(formatDate(doc.issueDate))}</div><div class="sign-area">${
    doc.images.stamp ? `<img class="stamp" src="${esc(doc.images.stamp)}" alt="">` : ""
  }${doc.images.signature ? `<img class="signature" src="${esc(doc.images.signature)}" alt="">` : ""}</div><div class="sign-line"></div>${
    s ? `<div class="sign-name">${esc(s.name)}</div><div class="sign-title">${esc(s.title)}</div>` : `<div class="sign-title">${bi(T.signature)}</div>`
  }</div>`;

  const productsBody = doc.products.length
    ? productTable(doc, true)
    : `<p class="notice">${bi(T.noProducts)}</p>`;

  const mainPage = `<div class="page page-main">${decoration(doc.watermark)}<div class="content">
<header class="head"><img class="logo" src="${a}/certificate/whu-logo.png" alt="WHU – World Halal Union"><div class="org">${esc(T.orgName)}</div><div class="org-sub">${esc(T.orgNameDe)} · ${esc(T.body)}</div></header>
<div class="title"><h1>${esc(T.title)}</h1><div class="title-en">${esc(T.titleEn)}</div><div class="title-ar" lang="ar" dir="rtl">${esc(T.titleAr)}</div></div>
<div class="number">${bi(T.number)} ${numberHtml}</div>
<p class="lead">${bi(T.certify)}</p>
<div class="company"><div class="company-name" data-autoshrink="20,13,2">${esc(c.name)}</div><div class="company-address">${addressLine}</div></div>
<p class="lead">${bi(T.complies)}</p>
<ul class="standards">${doc.standards.map((st) => `<li><b>${esc(st.code)}</b> — ${esc(st.title)}</li>`).join("")}</ul>
<div class="kv-grid">${kv.join("")}</div>
<section class="products"><h2 class="section-title">${bi(T.products)}</h2><div class="products-body">${productsBody}</div></section>
<div class="dates"><div class="date"><div class="k">${bi(T.issueDate)}</div><div class="v">${esc(formatDate(doc.issueDate))}</div></div><div class="date"><div class="k">${bi(T.validUntil)}</div><div class="v">${esc(formatDate(doc.validUntil))}</div></div><div class="date"><div class="k">${bi(T.auditDate)}</div><div class="v">${esc(formatDate(doc.auditDate))}</div></div></div>
<div class="bottom">${qrBlock}${signBlock}</div>
${footer()}
</div></div>`;

  const annexTemplate = `<template id="annex-page"><div class="page page-annex">${decoration(doc.watermark)}<div class="content">
<header class="annex-head"><img class="logo-sm" src="${a}/certificate/whu-logo.png" alt=""><div><div class="annex-title">${bi(T.annexTitle)}</div><div class="annex-meta">${bi(T.number)} <b>${esc(number ?? T.draftNumber)}${doc.revision > 0 ? ` · Rev. ${doc.revision}` : ""}</b> · ${esc(c.name)}</div></div></header>
<section class="products"><h2 class="section-title">${bi(T.products)}</h2><div class="products-body">${productTable(doc, false)}</div></section>
${footer()}
</div></div></template>`;

  const annexNotice = `<template id="annex-notice"><p class="notice">${bi(T.productsInAnnex(doc.products.length))}</p></template>`;

  // Static script (no document data inside): layout fixes that need real text measurement.
  const script = `(async function(){
var done=function(){document.documentElement.setAttribute("data-ready","1");window.__certReady=true;};
try{
if(document.fonts&&document.fonts.ready){await document.fonts.ready;}
await new Promise(function(resolve){var first=document.querySelector(".page");var check=function(){if(!first||first.getBoundingClientRect().height>0){resolve();}else{setTimeout(check,100);}};check();});
document.querySelectorAll("[data-autoshrink]").forEach(function(el){
var p=el.getAttribute("data-autoshrink").split(",").map(Number),size=p[0],min=p[1],lines=p[2];
var fits=function(){return el.getBoundingClientRect().height<=size*1.18*lines*96/72+1;};
el.style.fontSize=size+"pt";
while(!fits()&&size>min){size=Math.round((size-0.5)*10)/10;el.style.fontSize=size+"pt";}
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
pages.forEach(function(pg,i){var n=pg.querySelector(".page-no");if(n){n.textContent=pageLabel(i+1,pages.length);}});
if(document.body.classList.contains("preview")){var fit=function(){var w=document.querySelector(".page").offsetWidth;document.body.style.zoom=String(Math.min(1,(window.innerWidth-24)/w));};fit();window.addEventListener("resize",fit);}
}finally{done();}
})();`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(T.title)} ${esc(number ?? "")}</title><style>${fontFaces(a)}${CSS}</style></head><body class="${options.mode}">${mainPage}${annexTemplate}${annexNotice}<script>${pageLabelFunction()}${script}</script></body></html>`;
}

/** Page label function, generated from the template texts (keeps wording in texts.ts). */
function pageLabelFunction(): string {
  const sample = T.page(7, 9); // "Seite 7 von 9 · Page 7 of 9"
  const pattern = sample.replace(/7/g, "{i}").replace(/9/g, "{n}");
  return `function pageLabel(i,n){return ${JSON.stringify(pattern)}.split("{i}").join(String(i)).split("{n}").join(String(n));}\n`;
}
