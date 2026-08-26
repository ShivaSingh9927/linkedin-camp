-- Discovery/variety engine — durable people-search memory.
-- SeenProfile: every profile surfaced to a user (cross-session dedup + saturation).
-- SearchQuery: one row per distinct boolean query (pagination depth + mined-out state).

-- CreateTable
CREATE TABLE "SeenProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "queryKey" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeenProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "filters" JSONB,
    "maxPageReached" INTEGER NOT NULL DEFAULT 1,
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'active',
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeenProfile_userId_linkedinUrl_key" ON "SeenProfile"("userId", "linkedinUrl");

-- CreateIndex
CREATE INDEX "SeenProfile_userId_seenAt_idx" ON "SeenProfile"("userId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchQuery_userId_queryKey_key" ON "SearchQuery"("userId", "queryKey");

-- CreateIndex
CREATE INDEX "SearchQuery_userId_lastRunAt_idx" ON "SearchQuery"("userId", "lastRunAt");

-- AddForeignKey
ALTER TABLE "SeenProfile" ADD CONSTRAINT "SeenProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
