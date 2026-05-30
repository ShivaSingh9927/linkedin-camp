-- Production OTP-handling support: add AccountHealth enum + columns to User.
-- Keeps the legacy `sessionInvalid` boolean as a derived mirror for now —
-- existing callsites continue to work; new code reads `accountHealth` directly.

CREATE TYPE "AccountHealth" AS ENUM (
    'HEALTHY',
    'OTP_REQUIRED',
    'SESSION_EXPIRED',
    'RESTRICTED',
    'NEEDS_LOGIN'
);

ALTER TABLE "User"
    ADD COLUMN "accountHealth"       "AccountHealth" NOT NULL DEFAULT 'HEALTHY',
    ADD COLUMN "accountHealthReason" TEXT,
    ADD COLUMN "accountHealthAt"     TIMESTAMP(3);

-- Backfill: existing sessionInvalid=true rows go to SESSION_EXPIRED. We can't
-- distinguish OTP_REQUIRED vs SESSION_EXPIRED from the legacy boolean, so the
-- conservative default is SESSION_EXPIRED (re-login fixes both, OTP is just
-- a sub-step of login when LinkedIn demands it).
UPDATE "User"
SET    "accountHealth" = 'SESSION_EXPIRED',
       "accountHealthAt" = NOW()
WHERE  "sessionInvalid" = TRUE;

CREATE INDEX "User_accountHealth_idx" ON "User" ("accountHealth");
