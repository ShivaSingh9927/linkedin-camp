# Architecture Documentation - Waalaxy Replication

## Project Overview
A hybrid LinkedIn outreach automation system consisting of a Chrome Extension, a Cloud Backend, and a Next.js Dashboard.

## Tech Stack
- **Frontend**: Next.js (App Router), TailwindCSS, Shadcn UI, React Flow.
- **Backend API**: Express (TypeScript).
- **Database & ORM**: PostgreSQL with Prisma.
- **Task Queuing**: Redis with BullMQ (or Trigger.dev/Inngest).
- **Execution Worker**: Node.js with Playwright + Stealth Plugin.
- **Authentication**: JWT-based auth for Dashboard and Extension sync.

## Directory Structure (Proposed)
```
/nuvodata/User_data/shiva/linkedin-camp/
├── apps/
│   ├── web/                # Next.js Dashboard
│   ├── backend/            # Express API & Workers
│   └── extension/          # Chrome Extension (Manifest V3)
├── packages/
│   ├── db/                 # Prisma schema and client
│   └── types/              # Shared TypeScript interfaces
└── docs/                   # Documentation
```

## Key Patterns
- **State Machine**: Campaigns are stored as JSON DAGs. Workers track lead progress through the DAG using a pivot table (`CampaignLead`).
- **Hybrid Auth**: Extension steals cookies; Backend uses them in isolated Playwright contexts.
- **Queue-Based Execution**: All LinkedIn actions are asynchronous and staggered via workers to avoid rate limiting.
