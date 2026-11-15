# Certificate template v1 (provisional)

WHU's official certificate template (`/reference/certificate-template.png`) has not been
supplied yet. Template v1 is a provisional, print-ready design built on the same
pipeline the final template will use; once the official design arrives it becomes
**template v2** — certificates issued with v1 keep v1 (`Certificate.templateVersion`).

- Code: `src/certificates/templates/v1/` (`render.ts` layout, `texts.ts` wording)
- Format: A4 portrait (210 × 297 mm), German / English, Arabic title
- One HTML document → admin preview (sandboxed iframe), PDF and PNG (Playwright/Chromium)
- Fonts embedded (`public/certificate/fonts`, SIL OFL): Noto Serif, Noto Sans (Latin +
  Latin Extended: ä ö ü ß, Turkish ı ş ğ İ, …), Noto Naskh Arabic
- Sample review: Admin → Certificates → *Template preview* (watermarked "MUSTER · SAMPLE")

## Elements (spec §5.1)

Positions are measured on the rendered page (top-left corner of the element, mm from the
page's top-left edge). Elements below the products area move with the product list height.

| Element | Static / dynamic | Data source | Font, size, colour | Position x, y (w × h) mm |
|---|---|---|---|---|
| Double frame + corner ornaments | static | — | navy #1b2a6b 0.8 mm, gold #a9844a 0.25 mm | 6, 6 (198 × 285) |
| Background rosette | static | — | navy, 4.5 % opacity | centred |
| WHU logo | static | `public/certificate/whu-logo.png` | — | 90.2, 14 (29.6 × 17) |
| "WORLD HALAL UNION" | static | — | Noto Sans 600, 8.5 pt, navy, spaced | centred, y 33.5 |
| Org subline | static | — | Noto Sans 400, 7 pt, grey | centred, y 37.5 |
| HALAL-ZERTIFIKAT | static | — | Noto Serif 700, 25 pt, navy | centred, y 45.4 |
| HALAL CERTIFICATE | static | — | Noto Sans 600, 9.5 pt, blue #0077a3 | centred, y 56.1 |
| شهادة حلال | static | — | Noto Naskh Arabic 700, 15 pt, gold | centred, y 60.6 |
| Certificate number + Rev. | dynamic | `Certificate.certificateNumber`, `revision` | Noto Sans 700, 11 pt, navy, gold box | 104.9, 71.2 (41.3 × 7.4) |
| "Hiermit wird bestätigt, dass …" | static | — | Noto Sans 8.8 pt | centred, y 82.6 |
| Company name | dynamic | snapshot `company.name` | Noto Serif 700, **20 pt → min. 13 pt**, max. 2 lines | centred, y 88.1, w 172 |
| Address · postal code city · country | dynamic | `Company.address`, `postalCode`, `city`, `country` (DE/EN name) | Noto Sans 9 pt | centred, y 97.4 |
| "… erfüllt / complies with …" | static | — | Noto Sans 8.8 pt | centred |
| Standards (code — title) | dynamic | `CertificateStandard` → `Standard.code`, `title` | Noto Sans 9 pt, code bold | centred, y ≈ 115 |
| Production site | dynamic, optional | `Certificate.productionSite` | label 8 pt / value 8.8 pt | grid row |
| Scope, category | dynamic | `Certificate.scope`, `category` | label 8 pt / value 8.8 pt | 19, 123.9 (172 × …) |
| Products table (#, product + description, brand, item no.) | dynamic | `CertificateProduct` (`sortOrder`) | Noto Sans 8.2 pt / 7 pt | 19, 137 (172 × ≈ 69) — flexible |
| Issue date · valid until · audit date | dynamic | `issueDate`, `validUntil`, `auditDate` | Noto Sans 700, 11 pt, navy | 19, 208.7 (172 × 12.1) |
| QR code | dynamic | `publicToken` → `https://halal-zertifizierung.de/v/{token}` | ECC **Q**, 37 modules: code **26 mm** + 4-module quiet zone = 31.6 mm | 19, 237.2 (31.6 × 31.6) |
| Link + certificate number under/next to QR | dynamic | as above | Noto Sans 6.8–8 pt | 53.6, 255.5 (55 × 13) |
| "München, {issue date}" | static + dynamic | `issueDate` | Noto Sans 8.5 pt | 115, 232 |
| Stamp + signature images | dynamic | `Signatory.stampImageKey`, `signatureImageKey` (frozen in the snapshot at issue) | stamp ≤ 30 × 25 mm, signature ≤ 46 × 16 mm | 115, 237 (76 × 23) |
| Signatory name / title | dynamic | snapshot `signatory.name`, `title` | Noto Sans 600 9 pt / 7.2 pt grey | 115, 261.1 / 265.4 |
| Validity note (DE · EN) | static | — | Noto Sans 6.2 pt grey | centred, y 271.8 |
| WHU address line | static | — | Noto Sans 6.2 pt grey | centred, y 278.3 |
| "Seite x von n · Page x of n" | automatic | — | Noto Sans 6.2 pt grey | centred, y 282 |
| Watermark "ENTWURF · DRAFT" / "MUSTER · SAMPLE" | conditional | draft status / sample | Noto Sans 700, 52 pt, red 15 % | centred, −32° |

### Annex pages ("Anlage / Annex")

If the products do not fit the products area of page 1 (≈ 14 single-line rows), page 1
shows "Die N zertifizierten Produkte sind in der Anlage … aufgeführt" and all products are
listed on annex pages in the same frame: header with small logo, "Anlage zum
Halal-Zertifikat / Annex to halal certificate", number and company; ≈ 50 rows per page,
continuous numbering, page numbers on every page.

## Rules implemented (spec §5.3)

- QR as vector (SVG), error correction Q, code ≥ 25 mm, 4-module quiet zone.
- Long company names shrink in 0.5 pt steps from 20 pt down to 13 pt (never smaller).
- Drafts: no number, no QR code (placeholder), diagonal "ENTWURF · DRAFT" on every page.
- Issued certificates are rendered once; the PDF and a PNG preview are stored privately
  with a SHA-256 checksum, and downloads verify the checksum.
- The renderer blocks all network access except the template's own fonts and logo.

## Still needed from WHU

1. The official template (PNG/PDF, ideally the design source) → becomes template v2.
2. **Vector logo** (SVG/AI/EPS/PDF). The only available logo is 313 × 180 px ≈ 265 dpi at
   29.6 mm — printable, but not crisp.
3. Signature and stamp scans (≥ 600 dpi, transparent PNG) — uploaded in Settings → Signatories.
4. Confirmation of the wording (`texts.ts`), the address line and the signatory block.
