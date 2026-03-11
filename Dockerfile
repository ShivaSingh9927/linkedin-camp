FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set the working directory
WORKDIR /app

# Copy package management files first
COPY package.json package-lock.json* ./

# Copy all the monorepo files
COPY . .

# Install dependencies
RUN npm install

# Install Playwright browser natively
RUN npx playwright install chromium

# Generate Prisma Client
RUN npx prisma generate --schema=packages/db/schema.prisma

# Build the backend workspace using Turbo
RUN npx turbo run build --filter=backend

# Start the server
CMD ["sh", "-c", "echo '🔄 Synchronizing LEADMATE database schema...' && npx prisma generate --schema=packages/db/schema.prisma && npx prisma db push --schema=packages/db/schema.prisma --accept-data-loss && echo '✅ Schema sync complete. Starting server...' && node apps/backend/dist/server.js"]
