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

# Start only the server (no db push) for diagnostic stability
# We want to see [BACKEND-INIT] in the logs immediately.
CMD ["sh", "-c", "echo '🚀 STARTING BACKEND CONTAINER' && node apps/backend/dist/server.js"]
