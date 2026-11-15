# WHU Halal Zertifizierung

New website for **WHU – World Halal Union** (halal-zertifizierung.de):

1. **Public site**: a modern rebuild of the existing one-page site (German).
2. **Admin panel** (`/admin`): issue and manage halal certificates from a fixed template.
3. **Verification**: every certificate carries a QR code → `/v/{token}` shows its live status.

> Status: **all 8 stages built** — public site, admin panel with the certificate workflow,
> PDF/QR rendering, public verification, e2e tests, Docker deployment with HTTPS and backups.
> Before go-live: WHU's open items in [docs/acceptance.md](docs/acceptance.md), first deployment
> on a test server ([docs/deploy.md](docs/deploy.md)).

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4; fonts self-hosted via `next/font` (no Google requests) |
| Database | PostgreSQL 17 + Prisma 7 (`prisma-client` generator, `pg` driver adapter) |
| Validation | zod 4 |
| Icons | Font Awesome Free (solid) as inline SVG |
| E-mail | nodemailer (SMTP) |
| Passwords | argon2id (`@node-rs/argon2`, OWASP parameters) |
| File storage | Garage (S3-compatible, self-hosted) — replaces MinIO, whose community images are discontinued |
| Runtime | Node.js 24 LTS, Docker Compose |

## Prerequisites

- Node.js **24 LTS** (`node -v` → v24.x)
- Docker Desktop or OrbStack (for PostgreSQL and Garage) — or, without Docker:
  `npx prisma dev` for PostgreSQL and `STORAGE_DRIVER=fs` for files
- Chromium for PDF rendering and tests: `npx playwright install chromium chromium-headless-shell`

## Local development

```bash
npm install
npm run setup:env        # creates .env with random secrets — then edit SEED_SUPERADMIN_EMAIL
npm run services:up      # starts postgres + storage (Garage) in Docker
npm run db:deploy        # applies migrations
npm run db:seed          # super admin (+ demo data if SEED_DEMO=true)
npm run dev              # http://localhost:3000
```

The seed prints the super admin password once if `SEED_SUPERADMIN_PASSWORD` is empty,
and the three demo verification links (active, expired, revoked).

Health check: `GET /api/health` → `{"status":"ok"}` (503 if the database is unreachable).

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js (runs `prisma generate` first) |
| `typecheck` | `prisma generate` + `next typegen` + `tsc --noEmit` |
| `lint` | ESLint (next/core-web-vitals + TypeScript rules) |
| `db:migrate` | create a new migration from schema changes (development) |
| `db:deploy` | apply pending migrations |
| `db:seed` | run `prisma/seed.ts` (idempotent) |
| `db:studio` | Prisma Studio |
| `setup:env` | create `.env` from `.env.example` with fresh secrets |
| `services:up` / `services:down` | start / stop the Docker services |
| `test:e2e` | production build + Playwright e2e suite (see below) |
| `admin` | emergency CLI: `list`, `unlock`, `reset-2fa`, `reset-password` |

## Tests

```bash
npm run typecheck && npm run lint
npm run test:e2e                                  # builds, then runs tests/e2e
SKIP_BUILD=1 npm run test:e2e -- tests/e2e/verify.spec.ts
```

The e2e suite runs against the **production build**. Every spec file gets its own new
database (migrated + seeded) and its own server, so specs never depend on each other and
nothing is ever reset or dropped. Without configuration each spec starts a throwaway
`prisma dev` database; with `E2E_POSTGRES_URL` (CI) it creates a database on that server.

| Spec | Covers |
|---|---|
| `site.spec.ts` | layout on phones, mobile menu, contact form (validation, honeypot, rate limit), SEO basics |
| `auth.spec.ts` | sign-in, 2FA, lockout, roles and permissions, users, forced password change, audit log |
| `template.spec.ts` | A4 PDF, embedded fonts, QR decodability, annex pagination, escaping |
| `certificates.spec.ts` | preview, PDF/PNG/QR downloads, private storage, checksum, tamper detection |
| `workflow.spec.ts` | settings + uploads, companies, editor, four-eyes approval, issue, suspend, revision, revoke, renew, export, legacy import |
| `verify.spec.ts` | `/v/{token}` in all states, DE/EN, check by number with ALTCHA, rate limits, scan log |

CI (`.github/workflows/ci.yml`): typecheck, lint, production dependency audit, e2e suite
against PostgreSQL 17, and Docker builds of all images.

## Full stack in Docker / production

```bash
npm run setup:env                                 # then edit .env (APP_URL, DOMAIN, SMTP, SEED_*)
docker compose up -d --build                      # postgres, storage, migrate (one-shot), app, caddy, backup
docker compose run --rm migrate npx prisma db seed
```

`migrate` applies migrations and exits; `app` starts only after it succeeds. Caddy serves
HTTPS for `DOMAIN` (automatic Let's Encrypt certificates); database, storage and app ports
bind to `127.0.0.1` only. The `backup` service writes a daily database dump and a copy of the
storage bucket to `BACKUP_DIR`. Step-by-step server setup, updates, backup/restore and
operations: **[docs/deploy.md](docs/deploy.md)**.

**Vercel** (serverless, EU region Frankfurt, Neon Postgres + private Vercel Blob) is supported as
an alternative: `vercel.json`, `npm run setup:vercel-env`, step by step in
**[docs/deploy-vercel.md](docs/deploy-vercel.md)**.

## Public site

One-page site in the section order of the original halal-zertifizierung.de, plus
`/impressum`, `/datenschutz` (placeholder until WHU supplies the text) and `/zertifikat-pruefen`.

- **Texts** live in [`content/de/*.json`](content/de), never in components. They are
  validated with zod at build time (`src/content/schema.ts`), so a broken file fails the build.
  Inline marks: `{{text}}` = accent colour, `\n` = line break on desktop.
- **Images** are in `public/assets/` and served through `next/image` (AVIF/WebP, responsive).
- **Fonts** (Open Sans, Oswald, Noto Naskh Arabic) are self-hosted by `next/font` — no requests to Google.
- **Contact form**: server action → zod validation → honeypot → rate limit (5 per hour per IP)
  → stored in `ContactMessage` → e-mail to `CONTACT_TO_EMAIL` if SMTP is configured.
  Without `SMTP_HOST` messages are only stored (visible in the admin panel under Messages).
- **No analytics, no cookies** → no consent banner needed.
- SEO: metadata + Open Graph, `sitemap.xml`, `robots.txt`, Organization JSON-LD.

## Admin panel (`/admin`)

English and Uzbek (switch **EN / UZ** in the sidebar and on the sign-in page; stored in the
`whu_admin_lang` cookie). Texts: `src/i18n/admin/en.ts` and `uz.ts` — the `AdminMessages` type
flags every missing key, so a further language (e.g. `de.ts`) is one file plus one line in `index.ts`.

**Approvals** (`/admin/approvals`): certificates submitted for approval, with a count in the
navigation. The approval window shows the certificate exactly as it will be issued, a checklist,
and "Approve and issue" / "Return to the issuer" (with reason). With the four-eyes principle on,
the person who created a certificate cannot approve it.

**Sign-in**
- E-mail + password (argon2id). Unknown e-mail and wrong password give the same message and timing.
- TOTP two-factor authentication (RFC 6238, any authenticator app), **mandatory for SUPER_ADMIN
  and ADMIN**, optional for others. Secrets are AES-256-GCM encrypted (`TOTP_ENCRYPTION_KEY`);
  a code can never be used twice.
- 5 failed attempts (password or code) → account locked for 15 minutes; additionally max.
  20 sign-in attempts per 15 minutes per IP.
- Sessions: random token in an `httpOnly`, `SameSite=Lax`, `Path=/admin` cookie (`Secure` on
  HTTPS); only its SHA-256 is stored. 2 h idle timeout, 12 h maximum. Sign-in, 2FA and
  sign-out end with a full page load so no secret or admin data stays in the browser.
- Users created by a super admin get a one-time temporary password (or an initial password the
  super admin enters) and must change it at the first sign-in.

**Authorisation** — `src/lib/auth/permissions.ts` holds the role → permission matrix.
`src/proxy.ts` only redirects requests without a session cookie; every page and every
server action re-checks session and permission on the server (`requireUser` / `authorize`).

| Role | Can |
|---|---|
| SUPER_ADMIN | everything, incl. users and settings |
| ADMIN | issue/suspend/revoke certificates, companies, messages, audit log |
| ISSUER | create and edit drafts (issued by an admin) |
| VIEWER | read-only |

**Audit log** — sign-ins (also failed), lockouts, 2FA, user changes, message status … are
written to `AuditLog`; a database trigger rejects UPDATE/DELETE/TRUNCATE.

**Emergency access** (e.g. the only super admin lost their phone):

```bash
npm run admin -- list
npm run admin -- unlock <email>
npm run admin -- reset-2fa <email>
npm run admin -- reset-password <email>   # prints a temporary password once
```

In Docker: `docker compose run --rm migrate npx tsx scripts/admin.ts <command> <email>`.

## Certificates: template, PDF, QR

Current design: **template v2 = WHU's official certificate** — see
[docs/certificate-template-v2.md](docs/certificate-template-v2.md). The provisional stage-5 design
([v1](docs/certificate-template-v1.md)) stays for certificates issued with it.

- `src/certificates/templates/vN/` — one pure function per template version: data in, a
  complete HTML document out. The admin preview (sandboxed iframe), the PDF and the PNG
  all come from the same HTML. Certificates keep the `templateVersion` they were issued with.
- `src/certificates/renderer.ts` — headless Chromium (playwright-core) renders A4 PDFs
  (tagged, fonts embedded) and PNGs; all network access is blocked except the template's
  fonts/logo from `public/certificate/`.
- QR codes: SVG, error correction Q, code edge 26 mm + 4-module quiet zone, pointing to
  `${APP_URL}/v/{publicToken}`; downloadable alone as SVG/PNG for packaging.
- Issued certificates: PDF + PNG are rendered once, stored privately (`src/lib/storage`,
  S3/Garage or local folder) with a SHA-256 that is checked on every download.

Local development needs the browser once:

```bash
npx playwright-core install --only-shell chromium
```

Storage: `STORAGE_DRIVER=s3` (Garage from docker-compose) or `STORAGE_DRIVER=fs` with
`STORAGE_DIR` (a local folder, handy without Docker).

## Certificate workflow

```
DRAFT ⇄ PENDING_APPROVAL → ACTIVE ⇄ SUSPENDED → REVOKED
                           ACTIVE/SUSPENDED → SUPERSEDED (when a new revision is issued)
```

- **Editor** (`/admin/certificates/new`, `/admin/certificates/{id}/edit`): six steps — company
  (existing or new) → scope, category, standards → products (manual, CSV or Excel import,
  max. 2000) → dates (valid until = issue date + default validity) → signatory → review.
  The live preview renders the real template in the browser with a DRAFT watermark; after
  the first save it shows the draft's real QR code.
- **Issuing** (`certificate.issue`, i.e. ADMIN/SUPER_ADMIN): number from the yearly counter →
  frozen snapshot → PDF + PNG rendered, stored privately with SHA-256 → `ACTIVE` → audit.
  With the **four-eyes principle** (Settings, on by default) the creator of a certificate
  can never issue it; ISSUER users submit drafts, an admin returns (with reason) or issues.
- **Status changes**: suspend / reactivate / revoke always need a reason (audit log).
- **Revision** (correction): same number, revision + 1, new token and PDF; the previous
  revision becomes `SUPERSEDED` and links to the new one. **Renew** copies a certificate
  into a new draft that gets a new number.
- Issued certificates are never edited or deleted; only drafts without a reserved number
  can be deleted. All business rules live in `src/certificates/workflow.ts` and re-check
  the state inside a row-locked transaction; server actions check permissions first.
- **List**: search (number, company, product), filters (status incl. expired, category,
  issue date range), sort, 25 per page, CSV (`;`, UTF-8 BOM, formula-safe) and Excel export
  of the filtered list (audited).
- **Companies**: list/search, create, edit (ADMIN), delete only without certificates.
- **Settings** (SUPER_ADMIN): number format, default validity, four-eyes; standards;
  signatories with signature/stamp upload (PNG/JPG/SVG ≤ 2 MB, re-encoded to PNG in the
  sandboxed browser — SVG scripts and metadata cannot survive; stored privately under
  content-addressed keys, never deleted, so issued certificates keep their images).
- **Legacy import** (`/admin/import`, ADMIN): CSV of certificates issued before the system;
  validated completely first, then imported all-or-nothing as `isLegacy` (verifiable by
  number and QR, no generated PDF). Column list on the import page.

## Public verification (`/v/{token}`, `/zertifikat-pruefen`)

- **QR code → `/v/{token}`**: big status banner — GÜLTIG/VALID (green), ABGELAUFEN/EXPIRED
  (grey), AUSGESETZT/SUSPENDED (orange), WIDERRUFEN/REVOKED (red), ERSETZT/SUPERSEDED (blue,
  with a link to the current revision) — then number, holder, scope, standards, products,
  dates, certification body, an authenticity warning with contact details and the check time.
  German/English: `?lang=de|en`, otherwise the browser language (neither → English).
- Content comes from the snapshot frozen at issue; the status is read live on every request
  (no caching), so a revocation shows immediately and `validUntil` expiry is automatic.
- Unknown tokens, drafts and certificates awaiting approval → "Zertifikat nicht gefunden"
  with a forgery warning. Pages and files send `X-Robots-Tag: noindex, nofollow`.
- **PDF herunterladen** and the preview image (a WebP rendition, ~80 kB instead of ~430 kB)
  are offered **only while the certificate is valid**; legacy imports show a note instead.
- **Check by number** (`/zertifikat-pruefen`): number + [ALTCHA](https://altcha.org)
  proof-of-work (self-hosted, no cookies, no third-party requests; challenges are signed with
  a key derived from `IP_HASH_SECRET`, each solution is accepted once). A hit opens the same
  result page; the newest issued revision of the number is shown.
- **Rate limits** per IP (Postgres): 30 page views/min, 30 file downloads/min, 10 manual
  checks/10 min, 30 challenges/10 min.
- **ScanLog** (DSGVO): channel (QR / manual), time, daily-rotating keyed IP hash, user agent
  (200 chars) and — if the reverse proxy sends `X-Country-Code` (or `CF-IPCountry`) — the
  country. Never an IP address. Bots/link previews, prefetches and reloads within a minute
  are not counted. Admins see the checks on the dashboard and on each certificate.

## Project structure

```
content/de/              site texts (German), one JSON file per section
prisma/
  schema.prisma          data model (see comments inside)
  migrations/            SQL migrations, incl. the AuditLog append-only trigger
  seed.ts                settings, standards, super admin, demo certificates
src/
  app/                   Next.js routes ((site) = public pages, admin/(auth|panel) = admin)
  components/admin/      admin UI primitives, sidebar
  i18n/admin/            admin texts (English)
  i18n/verify.ts         verification page texts (German + English)
  components/verify/     public verification page
  certificates/          template versions, QR, renderer (PDF/PNG), loading + stored files,
                         workflow (state machine), draft schema, image uploads, legacy import
  components/site/       public site components (hero, slider, sections, contact form …)
  content/               content loader + zod schema for content/de
  lib/
    env.ts               zod-validated server environment
    db.ts                Prisma client (server-only)
    auth/                sessions, TOTP, permissions, login rules (Data Access Layer)
    contact/             contact form server action + validation
    security/            IP hashing, Postgres rate limiting
    mail.ts              SMTP notifications (nodemailer)
    tokens.ts            unbiased base62 public tokens (16 chars ≈ 95 bits)
    auth/password.ts     argon2id hash/verify
    certificates/        number format, frozen snapshot type, status
    settings.ts          admin settings (number format, validity, four-eyes)
    csv.ts               CSV reader/writer (browser + server)
    admin-actions.ts     shared server-action helpers (permission check, errors)
    verify/              public lookup, scan log + rate limits, ALTCHA
  generated/prisma/      generated Prisma client (git-ignored)
docker/garage.toml       storage config (secrets come from env)
docker/Caddyfile         HTTPS reverse proxy
docker/backup/           daily backup job (pg_dump + storage copy), restore script
tests/e2e/               Playwright e2e suite (per-spec database + server)
docs/                    deploy guide, acceptance checklist, certificate template v1
scripts/setup-env.mjs    .env generator
```

## Data model notes

- `EXPIRED` is never stored; it is derived from `validUntil < today`.
- Certificate numbers come from a per-year `Counter` row, incremented atomically.
- On issue, `Certificate.snapshot` freezes all printed data (company, products, standards,
  signatory, dates). Later edits to master data never change an issued certificate.
- `AuditLog` is append-only, enforced by a database trigger (UPDATE/DELETE/TRUNCATE fail).
- `ScanLog` stores no IP addresses — only a keyed hash and an approximate country (DSGVO).
- `PENDING_APPROVAL` supports the four-eyes rule (ISSUER submits, ADMIN issues).

## Environment variables

See [`.env.example`](.env.example). Secrets live only in `.env`, which is git-ignored.
