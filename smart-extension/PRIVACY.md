# Privacy Policy — Qampi Lead Importer

_Last updated: June 30, 2026_

This Privacy Policy describes how the **Qampi — Lead Importer** browser extension
("the Extension"), published by Qampi ("we", "us"), handles information. Contact:
**privacy@qampi.com**.

## Single purpose

The Extension lets a signed-in Qampi user import LinkedIn leads into their Qampi
account and keep the reply status of those leads in sync with their Qampi
dashboard.

## What we collect and why

The Extension only processes data when you are signed in to Qampi and actively
use a feature.

| Data | When | Why | Where it goes |
|------|------|-----|---------------|
| **Qampi authentication token** | When you connect the Extension to your dashboard | To authenticate your requests to the Qampi API on your behalf | Stored locally (`chrome.storage.local`); sent only to the Qampi API (`api.qampi.com`) |
| **LinkedIn lead data you choose to import** (name, headline/title, profile URL, company, education, location) | When you run an extraction from the side panel | To create or update lead records in your Qampi account | Sent to the Qampi API (`api.qampi.com`) |
| **CSV text you paste into the batch processor** | When you use the CSV batch tool | Parsed **on your device** to structure lead fields | Stays in the browser; only the resulting leads you import are sent to Qampi |
| **Reply-status signals** (a LinkedIn conversation URL + whether a reply was detected) | When you have a LinkedIn messaging tab open | To update the lead's status in your dashboard | Sent to the Qampi API (`api.qampi.com`) |

## What we do NOT collect

- We do **not** read, store, or transmit your LinkedIn cookies, passwords, or
  login credentials. (Session handling for any server-side features is done by
  Qampi's own backend, not this Extension.)
- We do **not** collect browsing history beyond the pages required for the
  features above (`linkedin.com` and your Qampi dashboard).
- We do **not** sell, rent, or share your data with third parties.
- We do **not** use your data for advertising.
- The CSV batch processor runs entirely on-device — your CSV is never uploaded.

## Data storage and retention

The authentication token is stored locally and removed when you sign out or
remove the Extension. Imported leads live in your Qampi account, governed by
Qampi's main Privacy Policy at https://qampi.com/privacy, and can be deleted
anytime from your dashboard.

## Permissions

Each permission is used solely to deliver the single purpose above. See the
store listing for per-permission justifications.

## Changes to this policy

Material changes are reflected by the "Last updated" date above.

## Contact

Questions or data-deletion requests: **privacy@qampi.com**.
