#!/usr/bin/env bash
# Build command on Vercel (vercel.json): database migrations, optional first admin, Next.js build.
set -euo pipefail

npx prisma generate

# Applies pending migrations (prisma.config.ts uses the direct, non-pooled URL if there is one).
# Preview deployments should point at their own database/branch, not at production.
npx prisma migrate deploy

# First super admin: only when both variables are set, so a generated password is never
# printed into the build log. Existing users are left unchanged; remove
# SEED_SUPERADMIN_PASSWORD from Vercel after the first login.
if [[ -n "${SEED_SUPERADMIN_EMAIL:-}" && -n "${SEED_SUPERADMIN_PASSWORD:-}" ]]; then
  SEED_DEMO=false npx prisma db seed
fi

npx next build
