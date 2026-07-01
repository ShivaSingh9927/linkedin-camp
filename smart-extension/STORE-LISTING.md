# Chrome Web Store — Listing & Review Answers (Qampi — Lead Importer)

Copy-paste these into the Developer Dashboard. Package to upload: zip the
**contents** of the `smart-extension/` folder (not the parent folder).

---

## Single purpose description

Qampi lets signed-in users import LinkedIn leads into their Qampi account and
keep those leads' reply status in sync with their Qampi dashboard.

## Permission justifications

**`storage`**
Stores the user's Qampi authentication token locally so the extension can make
authenticated requests to the Qampi API on the user's behalf, plus a
short-lived de-duplication record so the same reply isn't reported twice.

**`tabs`**
Used to locate the user's open Qampi dashboard tab (to retrieve their login
token) and their open LinkedIn tab (to run the lead extraction the user
starts from the side panel).

**`scripting`**
Injects a script into the user's own Qampi dashboard tab to read the
authentication token, and into the user's open LinkedIn tab to collect the
lead fields the user has chosen to import.

**`sidePanel`**
The lead-import workflow runs in a side panel so the user can review and
control extraction while staying on the LinkedIn page.

**Host — `*://*.linkedin.com/*`**
The core feature reads lead data from LinkedIn pages the user is viewing and
detects when a contact has replied.

**Host — `https://app.qampi.com/*`**
Reads the user's authentication token from the Qampi dashboard after login.

**Host — `https://api.qampi.com/*`**
Sends imported leads and reply-status updates to the Qampi API.

## Data usage disclosures (certification)

Collected: **Personally identifiable information** (names/titles/profile URLs of
leads the user imports) and **Authentication information** (the user's own Qampi
token). Then certify:
- ☑ I do not sell or transfer user data to third parties (outside approved use cases).
- ☑ I do not use or transfer user data for purposes unrelated to the single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness / for lending.

## Privacy policy URL

**https://qampi.com/extension-privacy** (live page at
`apps/landing/src/app/extension-privacy/page.tsx` — deploys with the landing site).

## Listing assets

- [x] 128×128 icon — `icons/icon128.png`
- [x] Screenshots (1280×800) — `store-assets/01-side-panel.png`, `store-assets/02-batch-processor.png` (provided at 2× = 2560×1600, accepted)
- [x] Short + detailed description — below
- [ ] Category: **Workflow & Planning** (fallback: Productivity)

### Short description (≤132 chars)

Import LinkedIn leads into Qampi from a side panel — extract clean prospect data and keep replies in sync, without leaving the page.

### Detailed description

Qampi — Lead Importer turns any LinkedIn search into clean, structured leads
inside your Qampi account, without copy-paste or spreadsheets.

Open the side panel on a LinkedIn search results page, name your list, and hit
Start Extraction. Qampi pulls each prospect's name, title, company, education,
and location, paginates through the results, and syncs everything straight to
your Qampi dashboard. Already have a spreadsheet? Paste a CSV into the built-in
batch processor and Qampi structures it on your device — no uploads, no model
downloads.

WHAT YOU GET
• One-click lead import from any LinkedIn people search
• Clean, structured fields (name, title, company, education, location)
• Automatic pagination across result pages
• On-device CSV batch processing — your data never leaves the browser
• Reply tracking that keeps each lead's status in sync with your dashboard
• A lightweight side panel that works while you keep browsing

HOW IT WORKS
1. Sign in to your Qampi dashboard and connect the extension.
2. Open a LinkedIn search and launch the side panel.
3. Extract leads and review them in Qampi.

Qampi — Lead Importer requires a Qampi account. It does not read your LinkedIn
password or cookies; it only imports the lead data you choose to extract.
Privacy policy: https://qampi.com/extension-privacy

---

## Future updates

1. Bump `"version"` in `manifest.json` (must be higher than the published one).
2. Re-zip the `smart-extension/` contents.
3. Upload to the **same item** in the Developer Dashboard → submit.
4. After review, Chrome auto-updates all installed users within hours.

## Notes / nice-to-haves (not blockers)

- `batch-process.html` header says "the LLM will extract…" while the footer says
  "regex extraction (no model needed)." The on-device extractor is regex-based —
  consider aligning the header copy to avoid confusion.
- `assets/logo.png` (32×32) is still used as a web-accessible resource for the
  in-page badge; the store icons now use the higher-res `icons/` set.
