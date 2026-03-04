# Continuity Ledger — AutoConnect Extension

- Goal: Build LinkedIn lead extraction Chrome extension with side panel UI, auto-pagination, pause/resume, and auto-export to backend CRM
- Success Criteria: User can extract all leads from LinkedIn search (including LinkedIn Members), control the extraction, and auto-export to the backend

- Constraints/Assumptions:
  - LinkedIn uses RSC with hashed CSS classes — must use data-* attributes
  - Chrome Side Panel API requires `sidePanel` permission in Manifest V3
  - Popup stays as default click action; side panel opens via button in popup
  - Content script continues running in LinkedIn tab even when user switches tabs

- Key decisions:
  - Side panel (dark theme) is the primary extraction UI — stays open while browsing
  - Popup kept for quick auth sync + as entry point to open side panel
  - State persisted to chrome.storage to survive panel close/reopen
  - List name REQUIRED before extraction starts
  - Auto-export on by default (sends to backend after scraping completes)
  - Max pages configurable (default 10)

- State:
  - Done:
    - Fixed DOM scraping with new LinkedIn data-view-name selectors
    - Fixed inject.js double-load guard
    - Fixed LinkedIn Member dedup with deterministic IDs
    - Fixed pagination with data-testid selectors
    - Created sidepanel.html with dark premium design
    - Created sidepanel.js with full extraction state machine (start/pause/resume/stop/export)
    - Updated manifest.json with sidePanel permission + side_panel config
    - Updated popup.html with "Open Extraction Panel" button
    - Updated popup.js with side panel opener handler
    - Updated background.js with side panel setup
    - Fixed multi-page extraction in side panel (direct URL navigation)
    - Fixed CSP violation from inline onclick handlers
    - **Fixed**: LinkedIn Member URLs — now stored as empty string instead of fake URLs
    - **Fixed**: Company vs Location confusion — company only from "Current:" line, location separate
    - **Added**: Location field extracted separately with country parsed out
    - **Added**: Gender detection from first name (Indian + common Western names)
    - **Updated**: Lead card UI shows company, location, gender icons
    - **Fixed**: addNewLeads deduplication for LinkedIn Members (composite key fallback)
  - Now:
    - User testing data quality fixes
  - Next:
    - Edge case: detect LinkedIn CAPTCHA/challenge pages
    - Edge case: handle LinkedIn login expiry
    - Edge case: retry logic for failed exports
    - Edge case: CSV export option

- Open questions:
  - Does the backend /api/v1/leads/import endpoint accept the new fields (location, country, gender)?
  - Should there be a CSV download option in addition to backend export?

- Working set:
  - apps/extension/content.js (UPDATED — scanDOM rewrite with gender, location, company fixes)
  - apps/extension/sidepanel.js (UPDATED — lead card display, addNewLeads dedup fix)
  - apps/extension/sidepanel.html (stable)
  - apps/extension/manifest.json (stable)
  - apps/extension/popup.html (stable)
  - apps/extension/popup.js (stable)
  - apps/extension/background.js (stable)
  - apps/extension/inject.js (stable)
