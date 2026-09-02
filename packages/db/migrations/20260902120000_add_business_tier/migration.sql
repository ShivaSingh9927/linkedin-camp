-- Add the BUSINESS subscription tier (buyer-facing "Business" plan).
-- Kept in its own migration: Postgres requires an enum value to be committed
-- before it can be used, so adding it separately from any DDL/DML that might
-- reference it is the safe pattern.

-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'BUSINESS';
