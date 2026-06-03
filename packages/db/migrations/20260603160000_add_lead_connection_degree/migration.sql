-- Lead.connectionDegree: 1 / 2 / 3 / NULL.
-- Captured at scrape time by the Chrome extension and re-written
-- canonically by PROFILE_VISIT + CHECK_CONNECTION. Enables IF_ELSE
-- gating without a runtime DOM probe.
ALTER TABLE "Lead" ADD COLUMN "connectionDegree" INTEGER;
