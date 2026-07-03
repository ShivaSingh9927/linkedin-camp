# Qampi — Product Marketing Context

Shared context for all marketing skills (seo-audit, competitors, programmatic-seo, schema, cold-email, cro, etc.). Read this before asking the user for positioning basics.

## What Qampi is
An AI-powered LinkedIn + cold-email outreach platform for B2B. It reads each prospect's LinkedIn profile, recent posts, and company activity, then writes personalized outreach that sounds genuinely human — sent safely at scale across LinkedIn and email.

- Website: https://qampi.com · App: https://app.qampi.com · Chrome extension: Qampi Lead Importer
- Category: LinkedIn automation / sales engagement / AI outreach

## Core value proposition
"Like a marketer wrote every message." Most automation blasts `Hi {FirstName}` templates; Qampi generates messages personal enough to actually get a reply, while keeping the LinkedIn account safe.

## Key differentiators
1. **Real per-prospect personalization** — AI reads profile + recent posts, not just merge tags.
2. **Account safety first** — dedicated ISP proxies, human-like sending patterns, randomized delays, working-hours windows, automatic limit monitoring that pauses before risk thresholds.
3. **Learns your voice** — upload writing samples; the AI matches tone, phrasing, formatting.
4. **LinkedIn + email in one sequence** — multi-touch, multi-channel, sequence-aware (opener → nudge → close, no repeated phrasing).
5. **CRM sync** — native HubSpot, Pipedrive, Notion (Zapier/Make coming).
6. **Goal-driven strategy** — the AI tailors ICP, messaging, and outreach to the user's goal.

## Tiers
- **Qampi Fast** (free): optimized model, profile-based personalization.
- **Qampi Pro** (paid): largest reasoning models, deep web research on company news/intent signals/shared connections.
No credit card to start · cancel anytime.

## ICPs / goals (the product models these as goalTypes)
- **sell** — founders, SDRs/AEs, sales teams, agencies generating leads.
- **recruiting** — recruiters/talent sourcing candidates.
- **job_seeking** — job seekers reaching hiring managers.
- **fundraising** — founders reaching investors.
- **networking** — professionals growing their network.

## Competitive landscape (for /vs and alternative pages)
Direct: Dripify, Expandi, Waalaxy, Dux-Soup, MeetAlfred, Lemlist (email-first), Skylead, HeyReach.
Qampi's wedge vs these: deeper AI personalization (reads posts, not just fields), safety posture (dedicated proxies + adaptive limits), and LinkedIn+email in one AI sequence rather than template merge-fields.

## Tone / voice
Confident, specific, a little irreverent ("Other tools automate. Qampi converts."). No hype clichés. Lead with the reply-rate/relationship outcome, not features. Always foreground safety for the LinkedIn-automation audience (their #1 fear is bans).

## SEO notes
Technical foundation is solid (SSR, metadata, canonical, sitemap, Organization + SoftwareApplication schema, blog with Article schema). Primary gaps being worked: commercial-intent page coverage (/for-* use-case pages, /vs-* comparison pages), FAQPage schema (done), keyword-accessible H1 (done). Blog lives in `src/content/blog`. Sitemap is `src/app/sitemap.ts`.
