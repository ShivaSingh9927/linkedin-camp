-- Lead.info: raw text snippet from the LinkedIn search-result card the
-- extension scraped this lead from. Lets the qampi UI show "what the
-- user saw on LinkedIn" alongside the parsed structured fields.
ALTER TABLE "Lead" ADD COLUMN "info" TEXT;
