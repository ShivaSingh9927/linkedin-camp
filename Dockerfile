# --------- BUILDER STAGE ---------
FROM node:20-bookworm-slim AS builder

# Set the working directory
WORKDIR /app

# Install openssl (required for Prisma to build the query engine properly)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package dependencies
COPY package.json package-lock.json* ./

# Copy all the monorepo files
COPY . .

# Install dependencies (respecting lockfile if present)
RUN npm install

# Generate Prisma Client natively
RUN npx prisma generate --schema=packages/db/schema.prisma

# Build the backend workspace using Turbo
RUN npx turbo run build --filter=backend

# --------- RUNNER STAGE ---------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install ONLY XVFB and Chromium's specific headless dependencies (ignoring Firefox/WebKit bloat)
# Adding openssl because Prisma Client requires it to query the Database at runtime
RUN apt-get update && apt-get install -y \
    xvfb \
    openssl \
    && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy the built source and installed node_modules from the builder stage
# This ensures we don't carry over npm caches or temporary build files from ~/.npm
COPY --from=builder /app ./

# Start the backend with xvfb-run to support headed browser mode in cloud seamlessly
CMD ["sh", "-c", "echo '🚀 STARTING BACKEND WITH XVFB' && xvfb-run -a node apps/backend/dist/server.js"]
