# Deployment on Vercel

Alternative to the Docker setup in [deploy.md](deploy.md). Everything runs in the EU:

| Part | Service | Region |
|---|---|---|
| Website, admin panel, PDF rendering | Vercel Functions (Node 24) | `fra1` Frankfurt (`vercel.json`) |
| Database | Neon Postgres (Vercel Marketplace) | `aws-eu-central-1` Frankfurt |
| Private files (PDFs, previews, signatures, stamps, logos) | Vercel Blob, access **private** | Frankfurt (`fra1`) |

What the repository already does for Vercel:

- `vercel.json` — region `fra1`, build command `scripts/vercel-build.sh`
  (`prisma generate` → `prisma migrate deploy` → optional first admin → `next build`).
- Storage driver `vercel-blob` (default when `VERCEL` is set): private objects, no public URLs.
- PDF/PNG rendering with `@sparticuz/chromium-min`: on a cold start the function downloads
  Chromium (≈ 70 MB, `CHROMIUM_PACK_URL`) to `/tmp`; the first PDF can take 10–20 s.
- Output tracing ships `public/certificate/**` (fonts, template images) and the complete
  `playwright-core` with the admin and `/v/*` functions; `maxDuration = 60` on rendering routes.
- `APP_URL` falls back to the project's `*.vercel.app` production domain until it is set.
- `prisma.config.ts` uses the direct connection (`DATABASE_URL_UNPOOLED`) for migrations,
  the app uses the pooled `DATABASE_URL`.
- `.vercelignore` keeps `.data/` (local database, private files, signatures) and `.env*` out
  of CLI uploads.

## 1. Project

Either connect a Git repository (GitHub/GitLab/Bitbucket) in Vercel → **Add New → Project →
Import**, or deploy from this folder with the Vercel CLI (`npx vercel`). Framework preset:
Next.js (detected); leave build/output settings at their defaults — `vercel.json` sets them.

Do not deploy before steps 2–4: the build needs the database.

## 2. Database (Neon, Frankfurt)

Project → **Storage → Create Database → Neon** → region **Frankfurt (aws-eu-central-1)** →
connect it to the project for **Production** (and Preview, ideally with "create a database
branch per preview deployment" so previews never migrate the production database).
The integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).

## 3. File storage (Vercel Blob, private)

Project → **Storage → Create → Blob** → region **Frankfurt**, access **Private** → connect it to
the project. This sets `BLOB_READ_WRITE_TOKEN`.

## 4. Environment variables

```bash
npm run setup:vercel-env
```

writes `.env.vercel` (git-ignored) from `vercel.env.example` with fresh secrets:
`IP_HASH_SECRET`, `TOTP_ENCRYPTION_KEY` and a 20-character `SEED_SUPERADMIN_PASSWORD`.
Edit `SEED_SUPERADMIN_EMAIL` (your own address), optionally `APP_URL` and SMTP, then
Project → **Settings → Environment Variables → Import .env** (or paste the content) for
Production (and Preview). Mark the secrets as *Sensitive*. Keep a copy of
`TOTP_ENCRYPTION_KEY` in a password manager: changing it invalidates every 2FA setup.

## 5. Deploy and first login

Deploy (Git push or `npx vercel --prod`). The build log shows the migrations and
`• Super admin created: …`. Then:

1. Open `https://<project>.vercel.app/api/health` → `{"status":"ok"}`.
2. Sign in at `/admin` with the seeded e-mail/password, change the password (Account) and
   enable two-factor authentication.
3. Delete `SEED_SUPERADMIN_PASSWORD` in Vercel (existing users are never changed by the seed).
4. Admin → **Certificates → Template preview → PDF**: proves that Chromium, fonts and
   template images work on Vercel. If it fails, check the function log (see Troubleshooting).
   Without signing in: `curl -H "Authorization: Bearer <HEALTH_RENDER_TOKEN>"
   https://<domain>/api/health/render` renders the sample certificate and round-trips a test
   object through Blob storage (`?pdf=1` returns the sample PDF). Without the variable the
   route answers 404.
5. Set up the data that only exists locally: signatory (signature, stamp), companies, settings
   (number format `H-2020{YY}.{NNNN}-1`, four-eyes), users.

## 6. Domain

Project → **Settings → Domains** → add `halal-zertifizierung.org` (and `www.` as redirect).
Either set the DNS records Vercel shows at the registrar, or (done for halal-zertifizierung.org,
registered at AHOST) switch the domain's nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`
so Vercel serves the whole zone (mail records then go into Vercel DNS too). Then set
`APP_URL=https://halal-zertifizierung.org` and
redeploy. **Do this before issuing real certificates** — every QR code keeps the URL that was
configured when it was issued.

## Sign-in

Production runs with `REQUIRE_2FA=false` (owner's decision, 2026-11-16): admins sign in with
e-mail and password only; 2FA stays available per user (Account → enable). Without the variable,
Super Admin and Admin must use an authenticator app. Lockout after failed logins still applies.

## E-mail (Resend)

- Domain `halal-zertifizierung.org` is verified in Resend (region eu-west-1) for sending and
  receiving; DNS records live in Vercel DNS (`resend._domainkey` TXT, `send`/`rsend` CNAME,
  `_dmarc` TXT, MX `@` → `receive-euw1.forge.rmta.net`).
- Contact form → SMTP: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`,
  `SMTP_USER=resend`, `SMTP_PASSWORD` = a *Sending access* API key restricted to the domain.
- Received mail (info@…) is read in Resend → Inboxes and copied into the admin panel
  (**Mailbox**) when the page opens, plus once a day by Vercel Cron (`/api/cron/inbox-sync`,
  `CRON_SECRET`). Needs `RESEND_API_KEY` = a *Full access* key (a sending key cannot read mail).
  Attachments up to 10 MB are stored in Blob; HTML is shown in a sandbox without scripts or
  remote images.

## Limits and notes

- **Request size:** Vercel accepts at most 4.5 MB per request. Image uploads are limited to
  2 MB, legacy CSV imports to 4 MB.
- **Chromium version:** `@sparticuz/chromium-min` 153 with `playwright-core` 1.65 (built for
  Chromium 159). CDP stays compatible across these versions; the template-preview PDF in
  step 5.4 is the check. When upgrading `playwright-core`, update the pack version in
  `src/certificates/renderer.ts` (or `CHROMIUM_PACK_URL`) to the newest Sparticuz release.
- **Chromium download:** the pack comes from GitHub releases on every cold start. For
  independence from GitHub, upload the `.tar` to a public location you control and set
  `CHROMIUM_PACK_URL` to it.
- **Backups:** Neon keeps point-in-time history (retention depends on the plan). Vercel Blob
  has no automatic backup — export the store regularly (e.g. `vercel blob list` + download
  script) or use the Docker setup with its daily backups for production.
- **Preview deployments** are protected by Vercel Authentication by default; leave that on
  (the admin panel of a preview uses its own database branch).
- **IP addresses:** Vercel sets `x-forwarded-for`; only salted hashes are stored (DSGVO).
- Sign Vercel's DPA (Data Processing Addendum) and mention Vercel/Neon as processors in the
  Datenschutzerklärung.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build fails at `prisma migrate deploy` | Database not connected (step 2) or no `DATABASE_URL` for that environment |
| `Invalid environment variables: IP_HASH_SECRET …` | Step 4 not done for this environment; redeploy after adding |
| `Vercel Blob storage needs BLOB_READ_WRITE_TOKEN` | Blob store not connected (step 3) |
| PDF route 500, log mentions Chromium / `libnss3` | Function memory < 1 GB or wrong pack architecture; keep the default 2 GB and the x64 pack |
| PDF without fonts/background | `public/certificate` missing from the function: check `outputFileTracingIncludes` in `next.config.ts` |
| QR codes point to `*.vercel.app` | `APP_URL` was not set when they were issued — set it, then create revisions |
