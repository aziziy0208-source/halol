# Acceptance checklist (spec §11)

How each criterion is met and where it is tested. E2E = `npm run test:e2e` (tests/e2e).

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Public site: sections, texts and look as the original; mobile works | ✅ (texts verbatim, 7 typos fixed) | `site.spec.ts` (no overflow at 360/390/768 px, mobile menu, anchors, contact form); Lighthouse mobile 100 on home |
| 2 | Certificates are created in the admin; preview = template image | ✅ **template v2 = WHU's official design** (positions within ± 0.3 mm of WHU's PDF) | [certificate-template-v2.md](certificate-template-v2.md); `workflow.spec.ts` (editor, live preview, logo), `template.spec.ts` (v2 layout) |
| 3 | PDF A4, sharp in print, German characters correct | ✅ | `template.spec.ts` (A4 MediaBox, fonts embedded, text not rasterised, umlauts); `docs/samples/*.pdf` |
| 4 | Phone camera on the QR opens exactly this certificate's page | ✅ | `verify.spec.ts` + `workflow.spec.ts` decode the QR from the rendered certificate and open the URL; QR ≥ 25 mm, ECC Q |
| 5 | Revoked → immediately red WIDERRUFEN | ✅ | `verify.spec.ts` (status read live, no caching) |
| 6 | `validUntil` passed → ABGELAUFEN automatically | ✅ | `verify.spec.ts` (EXPIRED is computed, never stored) |
| 7 | Wrong token → "nicht gefunden"; drafts never public | ✅ | `verify.spec.ts` (unknown/malformed token, DRAFT, PENDING_APPROVAL) |
| 8 | Not signed in → no `/admin`; VIEWER cannot create certificates | ✅ | `auth.spec.ts` (redirects, role matrix, server actions re-check the role) |
| 9 | Every action in the AuditLog | ✅ | `auth.spec.ts`, `workflow.spec.ts` (audit entries per action; DELETE on AuditLog fails) |
| 10 | Lighthouse (mobile) ≥ 90 | ✅ | home 100/100/100/100, `/zertifikat-pruefen` 100/100/100/92, `/v/…` 95/100/100 (SEO low on purpose: noindex) |

## Deliverables (spec §10)

| Item | Where |
|---|---|
| Code + README (install, `.env.example`, deploy) | repository, [README](../README.md), [deploy guide](deploy.md) |
| `docker-compose.yml` (app, postgres, object storage) | + Caddy (HTTPS) and the backup job; Garage instead of MinIO (images discontinued) |
| Migrations, seed (super admin, test company, 3 test certificates) | `prisma/migrations`, `prisma/seed.ts` |
| Playwright e2e tests of the main flows | `tests/e2e` (6 spec files), CI in `.github/workflows/ci.yml` |

## Agreed deviations from the spec

- Own session authentication (instead of Auth.js), TOTP 2FA mandatory for admins.
- ALTCHA (self-hosted proof-of-work) instead of Cloudflare Turnstile — no third-party requests.
- Garage instead of MinIO; Next.js 16; status `PENDING_APPROVAL` for the four-eyes principle;
  certificate content frozen as a snapshot at issue.
- The PDF/preview on the verification page is offered only while a certificate is valid.

## Not verified here

- The Docker images and `docker compose` were not run on the development machine (no Docker);
  the CI workflow builds them. The first deployment should follow [deploy.md](deploy.md) on a test server.
- Real e-mail delivery (SMTP) and Let's Encrypt need the production server.

## Open questions for WHU

Office address — the official certificate uses Brudermühlstr. 12, the website footer/Impressum
still Rupert-Mayer-Str. 44; contact e-mail domain (.de/.com); Impressum (DDG, Aufsichtsbehörde);
Datenschutz text; signature scan upload; certificate numbers: `H-2020{YY}.{NNNN}-1` is the default — confirm what "2020" and "-1" mean
and continue the 2026 sequence (legacy import); legacy register format; three dead weblinks (mui.or.id, fiqhacademy.org.sa, esma.gov.ae).
