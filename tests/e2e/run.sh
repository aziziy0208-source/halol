#!/bin/bash
# Playwright e2e suite against the production build.
#
#   npm run test:e2e                                       # local: throwaway `prisma dev` databases
#   E2E_POSTGRES_URL=postgresql://postgres:…@host/postgres npm run test:e2e
#                                                          # CI: a Postgres server; each spec gets a NEW database
#   SKIP_BUILD=1 npm run test:e2e -- tests/e2e/verify.spec.ts
#
# Each spec file starts its own seeded database and server (tests/e2e/environment.ts).
set -euo pipefail
cd "$(dirname "$0")/../.."
export NEXT_TELEMETRY_DISABLED=1
[ "${SKIP_BUILD:-}" = "1" ] || npm run build
npx playwright test "$@"
