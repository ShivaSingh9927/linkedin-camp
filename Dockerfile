FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set the working directory
WORKDIR /app

# Install Node.js
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Enable Corepack (for npm, pnpm, yarn)
RUN npm i -g corepack@latest && corepack enable

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

# Start the server (with DB push just like the Railpack logs)
CMD ["sh", "-c", "npx prisma db push --schema=packages/db/schema.prisma && node apps/backend/dist/apps/backend/src/server.js"]
