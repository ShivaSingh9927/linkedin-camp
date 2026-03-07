# Continuity Ledger — LinkedIn Campaign Tool

- Goal: Build full LinkedIn prospecting + messaging platform with Chrome extension, web dashboard, and inbox
- Success Criteria: Users can extract leads, run campaigns, manage inbox conversations, and use message templates

- Constraints/Assumptions:
  - LinkedIn uses RSC with hashed CSS classes — must use data-* attributes
  - Chrome Side Panel API requires `sidePanel` permission in Manifest V3
  - No LinkedIn official API — all message data comes from extension scraping or campaign logs

- Key decisions:
  - Side panel (dark theme) is the primary extraction UI
  - Inbox Phase 1 = campaign message logs + manual notes (no LinkedIn sync yet)
  - Message templates are shared between Inbox and Campaign workflows
  - Notifications use real database model (not mock data)

- State:
  - Done:
    - Chrome extension with full LinkedIn lead extraction
    - Prospects page with tag-based list sidebar, fixed filters, individual filter removal
    - Campaign builder with drag-and-drop workflow
    - Inbox Phase 1: 3-panel messaging UI (conversations, thread, lead details)
    - Message Templates: CRUD with auto-variable detection ({{firstName}}, {{company}}, etc.)
    - Team Feature Phase 1: Schema updated, backend API created, and premium dashboard UI built.
    - Team Feature Phase 2: Built Join Workspace UI, Anti-Duplication Protection, Crew Stats on Dashboard, and Account Switcher for Admins.
    - Cloud Execution & Safety Engine: Implemented working hours, randomized jitter delays, and stealth headless browsing patterns. 
    - Session Sync: Implemented Waalaxy-style Chrome extension real-time cookie synchronization.
    - Cloud Kill Switch: Added DB state locks (`cloudWorkerActive`, `lastCloudActionAt`). Stopped the extension from scraping simultaneously when headlees browser campaigns are actively sending messages.
    - Proxy Backend Logic Prepared: Added logic to inject proxy strings directly into the playwright context (mimicking the Waalaxy static IP assignment strategy behind the scenes).
    - Smart Reply Detection: Halted active campaigns for prospects automatically when user receives a message from them in Inbox.
    - Auto-Withdraw Invites: Scheduled daily cron to withdraw pending connection requests older than 30 days.

  - Now:
    - Running End-to-end tests across all implemented cloud features.
  - Next:
    - End-to-end testing across 24h real-world cycle.
    - Review overarching agency requirements.

- Open questions:
  - When to start Phase 2 inbox (LinkedIn message sync)?
  - Should templates be shared across team members?

- Working set:
  - packages/db/schema.prisma
  - apps/backend/src/workers/inbox.worker.ts
  - apps/backend/src/workers/withdraw.worker.ts
  - apps/backend/src/cron/scheduler.ts
  - apps/backend/src/workers/linkedin.worker.ts
