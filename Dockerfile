# --------- BUILDER STAGE ---------
# Full monorepo install + build. Heavy (~3 GB) but never shipped.
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy everything (.dockerignore strips node_modules / dist / .next).
COPY . .

RUN npm install
RUN npx prisma generate --schema=packages/db/schema.prisma
RUN npx turbo run build --filter=backend

# Strip devDependencies across all workspaces — drops tsup, typescript,
# @types/*, ts-node-dev, etc. so the runtime image carries only what the
# running process actually needs.
RUN npm prune --omit=dev

# --------- RUNNER STAGE ---------
# Slim runtime: pruned node_modules + built dist + Playwright Chromium.
# Result: ~700 MB instead of ~3.7 GB.
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# xvfb for headed Playwright in cloud; openssl for Prisma runtime.
RUN apt-get update && apt-get install -y \
        xvfb \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Production node_modules only.
COPY --from=builder /app/node_modules ./node_modules

# Workspace package.jsons — npm + Prisma resolve paths off these.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json

# Prisma schema — needed if any runtime path triggers a generate or push.
COPY --from=builder /app/packages/db/schema.prisma ./packages/db/schema.prisma

# Built backend bundle. tsup bundles @repo/db + @repo/types in, so the
# packages' own dist dirs aren't needed at runtime.
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Playwright Chromium. Install last — heavy browser layer rarely changes.
RUN npx playwright install chromium && npx playwright install-deps chromium

CMD ["sh", "-c", "echo '🚀 STARTING BACKEND WITH XVFB' && xvfb-run -a node apps/backend/dist/server.js"]
