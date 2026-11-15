# Deployment and operations

Target: one Linux VPS in the EU (DSGVO), Docker Compose. Everything — app, PostgreSQL,
object storage (Garage), HTTPS proxy (Caddy) and the backup job — runs on that server.

```
Internet ──443──▶ caddy ──▶ app (Next.js + Chromium) ──▶ postgres
                                  │                    └▶ storage (Garage, S3)
                       backup ────┴── daily: pg_dump + storage copy → ./backups (+ off-site)
```

## 1. Server

- VPS with **2 vCPU / 4 GB RAM / 40 GB disk** or more, Ubuntu 24.04 LTS, data centre in
  the EU (e.g. Hetzner Falkenstein/Nürnberg, netcup, IONOS). Sign the provider's DPA (AV-Vertrag).
- DNS: `A` (and `AAAA`) records for `halal-zertifizierung.org` and `www.halal-zertifizierung.org`
  pointing to the server.
- Firewall: allow only 22 (SSH, key login only), 80 and 443.

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh          # Docker Engine + Compose plugin
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable
```

## 2. Configuration

```bash
git clone <repository-url> whu && cd whu
# .env with fresh random secrets (Node is not needed on the host):
docker run --rm -v "$PWD":/app -w /app node:24-alpine node scripts/setup-env.mjs
nano .env
```

Set at least:

| Variable | Production value |
|---|---|
| `APP_URL` | `https://halal-zertifizierung.org` — QR codes point here, **never change it later** |
| `DOMAIN` / `REDIRECT_DOMAIN` | `halal-zertifizierung.org` / `www.halal-zertifizierung.org` |
| `ACME_EMAIL` | an address that receives certificate expiry notices |
| `SMTP_*`, `CONTACT_TO_EMAIL` | mail server for contact form notifications |
| `SEED_SUPERADMIN_EMAIL` / `_NAME` | the first super admin; leave `SEED_SUPERADMIN_PASSWORD` empty |
| `SEED_DEMO` | **`false`** |
| `BACKUP_DIR` | e.g. `/srv/whu-backups` |

`TOTP_ENCRYPTION_KEY` must stay stable (changing it invalidates every authenticator).
Keep a copy of `.env` in a password manager — without it backups cannot be restored with 2FA intact.

## 3. Start

```bash
docker compose up -d --build                         # migrate runs first, then app, caddy, backup
docker compose run --rm migrate npx prisma db seed   # prints the super admin password ONCE
docker compose ps                                    # all services "running" / "healthy"
curl -I https://halal-zertifizierung.org/api/health
```

Then sign in at `/admin`: set up two-factor authentication, change the password, and in
**Settings** add the signatories (signature/stamp images), check the standards, the number
format and the default validity. Further users: **Users**. Old certificates: **Import**.

The browser for PDF rendering (Chromium) is part of the app image. Certificate PDFs, signature
and stamp images live only in the private Garage bucket; the app serves them after checks.

## 4. Updates

```bash
git pull
docker compose up -d --build      # builds, applies new migrations (migrate), restarts the app
docker image prune -f
```

## 5. Backups

The `backup` service runs every day at `BACKUP_TIME` (`Europe/Berlin`):

- `BACKUP_DIR/db/whu-YYYY-MM-DD_HHMM.dump` — full PostgreSQL dump (custom format),
  kept `BACKUP_KEEP_DAYS` days;
- `BACKUP_DIR/files/` — copy of the storage bucket (only additions; certificates are never deleted).

Check it: `docker compose logs backup`, or run one now:
`docker compose exec backup backup.sh`.

**Off-site copy (strongly recommended):** a backup on the same server does not survive the loss
of the server. Either copy `BACKUP_DIR` elsewhere yourself, or set `BACKUP_RCLONE_REMOTE` and put
the rclone remote's settings into `backup.env` (not committed), e.g. a Hetzner Storage Box:

```bash
# backup.env
RCLONE_CONFIG_OFFSITE_TYPE=sftp
RCLONE_CONFIG_OFFSITE_HOST=u123456.your-storagebox.de
RCLONE_CONFIG_OFFSITE_USER=u123456
RCLONE_CONFIG_OFFSITE_PORT=23
RCLONE_CONFIG_OFFSITE_KEY_FILE=/backups/.ssh/id_ed25519
# .env
BACKUP_RCLONE_REMOTE=offsite:whu-backups
```

### Restore

Practise this once before go-live, on a test server.

1. Start only the data services: `docker compose up -d postgres storage`.
2. Database — into the (empty) database of a fresh installation:
   ```bash
   docker compose exec -T postgres pg_restore -U whu -d whu --no-owner < /srv/whu-backups/db/whu-2026-11-15_0230.dump
   ```
   Restoring over an existing database replaces its data: do that only deliberately, after a
   fresh dump of the current state.
3. Files: `docker compose run --rm --entrypoint restore-files.sh backup`
4. Use the same `.env` as before (`TOTP_ENCRYPTION_KEY`, `IP_HASH_SECRET`), then
   `docker compose up -d`.

## 6. Operations

| Task | Command |
|---|---|
| Logs | `docker compose logs -f app` (or `caddy`, `backup`) |
| Health | `GET /api/health` — add it to an uptime monitor |
| Locked out / lost phone | `docker compose run --rm migrate npx tsx scripts/admin.ts unlock <email>` (also `reset-2fa`, `reset-password`, `list`) |
| Database shell | `docker compose exec postgres psql -U whu whu` |

- The audit log is append-only (a database trigger rejects UPDATE/DELETE/TRUNCATE).
- The scan log stores no IP addresses. The country is filled only if the proxy sends
  `X-Country-Code` (Caddy does not do GeoIP by default — optional).
- HTTPS certificates renew automatically (Caddy). HSTS is sent by the app in production.
- Rotating `IP_HASH_SECRET` is harmless (rate-limit buckets and open ALTCHA challenges reset).

## 7. Before go-live (WHU)

- Datenschutzerklärung text (the page is a placeholder and `noindex`), Impressum details
  (DDG instead of TMG, Aufsichtsbehörde), the correct office address.
- Official certificate design → template v2 (`src/certificates/templates/v2`), signature and
  stamp scans, vector logo.
- Certificate number format and default validity (Settings), legacy register as CSV (Import).
