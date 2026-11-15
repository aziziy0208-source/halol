# Certificate template v2 — WHU's official design

Source: `WHU_Certificate_EN_2026.docx` (WHU), checked against WHU's own PDF export
("WHU Certificate EN 2026 DIGI.pdf"). Code: `src/certificates/templates/v2/`.
Template v2 is used for every certificate issued from now on; certificates issued
earlier keep the template they were issued with (v1).

## What was taken from the original

| Element | Original | v2 |
|---|---|---|
| Page | A4, margins 20.1 / 22.4 mm | same |
| Background (header with logo, "ZERTIFIKAT / CERTIFICATE", Arabic calligraphy, world map, footer with e-mail and web address) | full-page image in the Word header | the same image (`public/certificate/v2/background.png`) |
| Font | Calibri 11–18 pt, single line spacing | Carlito (metric-compatible with Calibri, OFL), same sizes and line spacing |
| Wording | English, as in the original | identical |
| Company logo | below "confirms that the company", 32.7 × 16.1 mm | uploaded per company (Companies → company → Company logo); left out if there is none |
| Company name / address | 18 pt bold / 14 pt bold | same; long names shrink to min. 12 pt (2 lines) |
| Standards, scope | 14 pt bold | from the certificate data |
| Products | one product: a single centred cell (Word original); several: numbered, two per row (WHU's PDF) | names centred, without a table grid (WHU's request); if they do not fit page 1 → "N products — see annex" and annex pages |
| Validity sentence, Certificate Nr., valid from/until, "Munich, date" | Word positions | same positions (± 0.3 mm against WHU's PDF) |
| Signature | 37 × 20.8 mm at 32.4 / 245.1 mm | the signatory's uploaded signature (Settings → Signatories) |
| "Member of International Halal Integrity Alliance" logo, WHU halal seal | fixed positions | same (`public/certificate/v2/`) |
| Issuer address | WHU – World Halal Union, Brudermuehlstr. 12, D-81371 Munich, Germany | same |

## Additions required by the system

- **QR code** (spec §8): 25 mm, above the IHI logo, where the original has free space.
  It links to `/v/{token}`; drafts show a dashed placeholder.
- **Annex pages** with the same background for long product lists, and "Page x of n"
  only when there is more than one page.
- **Watermarks**: "ENTWURF · DRAFT" on drafts, "MUSTER · SAMPLE" on template samples.
- Optional "Production site:" line when a certificate has one.

## Not printed (as in the original)

Signatory name and position, category, audit date, the signatory's stamp image (the WHU
halal seal is part of the design). These stay in the system and on the verification page
where applicable.

## Data the original shows that WHU must provide

- Signature scan of the signatory → Settings → Signatories (stored privately, never a public URL).
- Company logos → per company.
- Standard codes as they should be printed (e.g. `OIC/SMIIC 1`) → Settings → Standards.
- Certificate numbers: the default format is now WHU's own, `H-2020{YY}.{NNNN}-1`
  (e.g. `H-202026.0021-1`; changeable in Settings). The running number restarts every year
  at 1 — before go-live the counter must continue WHU's existing numbers (import the old
  register, which moves the counter past every imported number).
