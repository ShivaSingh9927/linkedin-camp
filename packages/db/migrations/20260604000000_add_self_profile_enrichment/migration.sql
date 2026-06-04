-- Self-profile enrichment: data scraped from the user's OWN LinkedIn profile
-- after they complete login through Qampi. Populated once by the background
-- enrichment job; feeds the AI strategy + message generation.
ALTER TABLE "BusinessProfile" ADD COLUMN "selfHeadline" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "selfAbout" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "selfRecentPosts" JSONB;
ALTER TABLE "BusinessProfile" ADD COLUMN "selfProfileSummary" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "selfProfileEnrichedAt" TIMESTAMP(3);
