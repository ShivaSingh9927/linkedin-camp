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
    - **Inbox Phase 1**: 3-panel messaging UI (conversations, thread, lead details)
    - **Message Templates**: CRUD with auto-variable detection ({{firstName}}, {{company}}, etc.)
    - **Backend**: New Message, MessageTemplate, Notification Prisma models
    - **Backend**: Full inbox API (conversations, messages, templates, notifications)
    - **Database**: Schema migrated with new tables
  - Now:
    - Testing Inbox UI + backend integration
  - Next:
    - Hook notification bell to real API (replace mock data in TopBar)
    - Phase 2 Inbox: Extension captures LinkedIn messages (reply sync)
    - Use templates in campaign workflow nodes
    - Team page implementation

- Open questions:
  - When to start Phase 2 inbox (LinkedIn message sync)?
  - Should templates be shared across team members?

- Working set:
  - packages/db/schema.prisma (UPDATED — Message, MessageTemplate, Notification models)
  - apps/backend/src/controllers/inbox.controller.ts (NEW)
  - apps/backend/src/routes/inbox.routes.ts (NEW)
  - apps/backend/src/server.ts (UPDATED — inbox routes registered)
  - apps/web/src/app/inbox/page.tsx (REWRITTEN — 3-panel inbox UI)
  - apps/web/src/components/SidebarWrapper.tsx (UPDATED — no padding for /inbox)
