# Chrome Web Store — Listing & Review Answers (Qampi — Lead Importer)

Copy-paste these into the Developer Dashboard. Package to upload: zip the
**contents** of the `smart-extension/` folder (not the parent folder).

---

## Single purpose description

> Qampi lets signed-in users import LinkedIn leads into their Qampi account and
> keep those leads' reply status in sync with their Qampi dashboard.

## Permission justifications

**`storage`**
> Stores the user's Qampi authentication token locally so the extension can make
> authenticated requests to the Qampi API on the user's behalf, plus a
> short-lived de-duplication record so the same reply isn't reported twice.

**`tabs`**
> Used to locate the user's open Qampi dashboard tab (to retrieve their login
> token) and their open LinkedIn tab (to run the lead extraction the user
> starts from the side panel).

**`scripting`**
> Injects a script into the user's own Qampi dashboard tab to read the
> authentication token, and into the user's open LinkedIn tab to collect the
> lead fields the user has chosen to import.

**`sidePanel`**
> The lead-import workflow runs in a side panel so the user can review and
> control extraction while staying on the LinkedIn page.

**Host — `*://*.linkedin.com/*`**
> The core feature reads lead data from LinkedIn pages the user is viewing and
> detects when a contact has replied.

**Host — `https://app.qampi.com/*`**
> Reads the user's authentication token from the Qampi dashboard after login.

**Host — `https://api.qampi.com/*`**
> Sends imported leads and reply-status updates to the Qampi API.

## Data usage disclosures (certification)

Collected: **Personally identifiable information** (names/titles/profile URLs of
leads the user imports) and **Authentication information** (the user's own Qampi
token). Then certify:
- ☑ I do not sell or transfer user data to third parties (outside approved use cases).
- ☑ I do not use or transfer user data for purposes unrelated to the single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness / for lending.

## Privacy policy URL

Host `PRIVACY.md` (rendered) publicly and paste the URL, e.g.
`https://qampi.com/extension-privacy`.

## Listing assets

- [ ] 128×128 icon — already in `icons/icon128.png`
- [ ] Screenshots (1280×800) — in `store-assets/` (provided at 2× = 2560×1600, accepted):
      `01-side-panel.png`, `02-batch-processor.png`
- [ ] Short description (≤132 chars) + detailed description
- [ ] Category: "Workflow & Planning" or "Productivity"

Suggested short description:
> Import LinkedIn leads into Qampi and keep replies in sync — straight from a side panel, without leaving the page.

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
