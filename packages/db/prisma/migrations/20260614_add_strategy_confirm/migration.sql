-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "strategyConfirmedAt" TIMESTAMP(3);
ALTER TABLE "BusinessProfile" ADD COLUMN "strategyConfirmedSections" JSONB;
