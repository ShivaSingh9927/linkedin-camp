-- Lead-run state machine: add LeadRunStatus + supporting columns on
-- CampaignLeadProgress, extend CampaignStatus with CANCELLED.
--
-- Backfills existing rows from the legacy flags (needsRetry/completedAt)
-- so the new `status` column is authoritative immediately.

-- 1. New enum for lead-run lifecycle.
CREATE TYPE "LeadRunStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DEFERRED',
    'REPLIED',
    'COMPLETED',
    'STALLED',
    'FAILED'
);

-- 2. Extend CampaignStatus with CANCELLED.
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 3. New columns on CampaignLeadProgress.
ALTER TABLE "CampaignLeadProgress"
    ADD COLUMN "status"         "LeadRunStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "statusReason"   TEXT,
    ADD COLUMN "deferralCount"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "terminalAt"     TIMESTAMP(3);

-- 4. Backfill from existing flags.
--    - completedAt set      → COMPLETED (terminal)
--    - needsRetry + future  → DEFERRED  (will be retried by cron)
--    - everything else      → PENDING (default)
UPDATE "CampaignLeadProgress"
SET    "status" = 'COMPLETED',
       "terminalAt" = "completedAt"
WHERE  "completedAt" IS NOT NULL;

UPDATE "CampaignLeadProgress"
SET    "status" = 'DEFERRED'
WHERE  "needsRetry" = TRUE
  AND  "completedAt" IS NULL;

-- 5. Supporting indexes — cron query (DEFERRED + nextRetryAt due) and
--    per-campaign aggregate (status counts on summary page).
CREATE INDEX "CampaignLeadProgress_status_nextRetryAt_idx"
    ON "CampaignLeadProgress" ("status", "nextRetryAt");

CREATE INDEX "CampaignLeadProgress_campaignId_status_idx"
    ON "CampaignLeadProgress" ("campaignId", "status");
