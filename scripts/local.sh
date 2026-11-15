#!/bin/bash
# Local preview without Docker: a persistent `prisma dev` database ("whu-local"),
# files in .data/storage and `next dev` on http://localhost:3000.
#   npm run local
# First run: creates .env (random secrets), the database, the demo data and a
# super admin whose password is written to .data/local-admin.txt (git-ignored).
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_TELEMETRY_DISABLED=1
# Node 24 is required; use a portable install in ~/.local/node-v24 if the default node is older.
if ! node -v 2>/dev/null | grep -q '^v24' && [ -d "$HOME/.local/node-v24/bin" ]; then
  export PATH="$HOME/.local/node-v24/bin:$PATH"
fi
mkdir -p .data/storage
[ -f .env ] || node scripts/setup-env.mjs

if [ -f .data/local-db-url ]; then
  npx prisma dev start whu-local >/dev/null 2>&1 || true
  DB_URL="$(cat .data/local-db-url)"
else
  DB_URL="$(npx prisma dev -n whu-local -d 2>&1 | grep -o 'postgres://[^ ]*' | head -1)"
  [ -n "$DB_URL" ] || { echo "could not start the local database" >&2; exit 1; }
  echo "$DB_URL" > .data/local-db-url
fi

[ -f .data/local-admin.txt ] || printf 'email: admin@example.com\npassword: %s\n' "$(openssl rand -hex 10)" > .data/local-admin.txt
chmod 600 .data/local-admin.txt

export DATABASE_URL="$DB_URL" DATABASE_POOL_MAX=1 APP_URL=http://localhost:3000 STORAGE_DRIVER=fs STORAGE_DIR=.data/storage
npx prisma migrate deploy >/dev/null
SEED_SUPERADMIN_EMAIL=admin@example.com SEED_SUPERADMIN_NAME="Super Admin" \
SEED_SUPERADMIN_PASSWORD="$(sed -n 's/^password: //p' .data/local-admin.txt)" SEED_DEMO=true \
  npx prisma db seed >/dev/null
echo "Local site: http://localhost:3000 — admin login in .data/local-admin.txt"
exec npm run dev -- -p 3000
