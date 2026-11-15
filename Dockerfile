# syntax=docker/dockerfile:1.7
# Multi-stage build: deps → builder → (tools | runner).
#   runner: production Next.js server (standalone output), runs as non-root.
#   tools:  one-shot jobs — `prisma migrate deploy` (default) and the seed.
#   The runner contains a headless Chromium (Playwright) that renders certificate PDFs/PNGs.

ARG NODE_VERSION=24.22.3
# Must equal the playwright-core version in package.json (browser build is tied to it).
ARG PLAYWRIGHT_VERSION=1.65.1

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
# `prebuild` runs `prisma generate` first (see package.json).
RUN npm run build

FROM deps AS tools
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src/lib ./src/lib
# The seed stamps demo certificates with the current template version.
COPY src/certificates ./src/certificates
COPY scripts ./scripts
COPY --from=builder /app/src/generated ./src/generated
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ARG PLAYWRIGHT_VERSION
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Chromium headless shell + its system libraries, for certificate PDF/PNG rendering.
# Fonts are embedded in the certificate HTML, so no system fonts are required.
RUN npx -y "playwright-core@${PLAYWRIGHT_VERSION}" install --with-deps --only-shell chromium \
 && rm -rf /root/.npm /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Output tracing copies only part of playwright-core (it loads files dynamically): ship all of it.
COPY --from=deps --chown=node:node /app/node_modules/playwright-core ./node_modules/playwright-core
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
