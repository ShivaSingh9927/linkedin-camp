FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set the working directory
WORKDIR /app

# Install system dependencies for Playwright and XVFB
RUN apt-get update && apt-get install -y \
    xvfb \
    libgbm-dev \
    libnss3 \
    libatk1.0-0 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

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

# Start the backend with xvfb-run to support headed browser mode in cloud
CMD ["sh", "-c", "echo '🚀 STARTING BACKEND WITH XVFB' && xvfb-run -a node apps/backend/dist/server.js"]
