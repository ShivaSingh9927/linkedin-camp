# Two-target Dockerfile.
#
# `api-runner`    — slim image for backend-api (no Playwright/Chromium).
#                   Used by the Express + Socket.IO process.
# `worker-runner` — full image for backend-worker (adds Playwright + xvfb).
#                   Used by the BullMQ worker that drives Chromium.
#
# Both share one builder stage so the install + tsup pass happens once.
#
# Build:
#   docker build --target api-runner    -t linkedin-camp-api:latest    .
#   docker build --target worker-runner -t linkedin-camp-worker:latest .

# --------- BUILDER ---------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm install
RUN npx prisma generate --schema=packages/db/schema.prisma
RUN npx turbo run build --filter=backend

# Drop devDependencies across all workspaces (tsup, typescript, @types/*, …).
RUN npm prune --omit=dev

# --------- API RUNNER (slim) ---------
# No Playwright, no Chromium, no xvfb. Just enough to run the Express +
# Socket.IO server. Result: ~500 MB.
FROM node:20-bookworm-slim AS api-runner

WORKDIR /app

RUN apt-get update && apt-get install -y \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/db/schema.prisma ./packages/db/schema.prisma
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Trim the heaviest Playwright pieces from the API image — they came in via
# the workspace hoist but the API process never loads them. Keeps the
# 'playwright' package require()-able for any incidental imports, but drops
# the ~300 MB browser-driver payload.
RUN rm -rf \
        ./node_modules/playwright-core/.local-browsers \
        ./node_modules/playwright/.local-browsers \
    || true

CMD ["sh", "-c", "echo '🚀 API SERVER' && node apps/backend/dist/server.js"]

# --------- WORKER RUNNER (full) ---------
# Includes Playwright Chromium + xvfb for headed automation.
FROM node:20-bookworm-slim AS worker-runner

WORKDIR /app

RUN apt-get update && apt-get install -y \
        xvfb \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/db/schema.prisma ./packages/db/schema.prisma
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Playwright Chromium + system deps. Heavy layer, install last.
RUN npx playwright install chromium && npx playwright install-deps chromium

CMD ["sh", "-c", "echo '🚀 WORKER WITH XVFB' && xvfb-run -a node apps/backend/dist/worker-entry.js"]
