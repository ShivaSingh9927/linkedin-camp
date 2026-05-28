# =============================================================================
# Research agent sidecar — Node + Lightpanda (headless browser) on the DB box.
# Called by ai-service before strategy gen so each agent prompt carries real
# scraped competitor positioning instead of pure LLM imagination.
# =============================================================================
FROM node:20-bookworm-slim AS runtime

# Lightpanda is a dynamically-linked glibc binary; the slim image needs the
# usual cert/ssl stack to make outbound HTTPS calls (Yahoo, target sites, the
# Cloudflare AI Gateway) work.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Pinned to the current nightly tag the user has been running locally. Bump
# this URL deliberately — silent "latest" upgrades have surprised us before.
ARG LIGHTPANDA_URL=https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux
RUN curl -fsSL -o /usr/local/bin/lightpanda "$LIGHTPANDA_URL" \
 && chmod +x /usr/local/bin/lightpanda \
 && /usr/local/bin/lightpanda version

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js research.js ./

ENV LIGHTPANDA_PATH=/usr/local/bin/lightpanda \
    PORT=8002 \
    NODE_ENV=production

EXPOSE 8002
CMD ["node", "server.js"]
