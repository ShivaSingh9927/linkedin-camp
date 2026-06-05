-- Surface full PROFILE_VISIT enrichment: persist scraped experience/education
-- (previously discarded) and timestamp each enrichment so the UI can show
-- what was captured and how fresh it is.
ALTER TABLE "Lead" ADD COLUMN "experience" JSONB;
ALTER TABLE "Lead" ADD COLUMN "education" JSONB;
ALTER TABLE "Lead" ADD COLUMN "enrichedAt" TIMESTAMP(3);
