import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

/**
 * Fast Enrichment (API mode) — same outcome as Stealth Enrichment but
 * uses Voyager API for the profile visit step instead of full DOM
 * navigation. ~50x faster per lead (300ms vs 15s), so a 1000-lead list
 * takes ~5 minutes instead of ~4 hours.
 *
 * Trade-offs vs the DOM-based Stealth Enrichment:
 *   - DOES NOT extract email/phone/connectedDate (Voyager never returns these)
 *   - DOES NOT scrape latest post (DOM required)
 *   - DOES NOT detect exact 2nd vs 3rd degree (only 1st-degree vs not)
 *   - DOES return: name, headline, summary, location, industry, photo,
 *     memberId, vanity, currentCompany/currentJobTitle (parsed from headline)
 *
 * Best for: bulk enrichment of large lists (CSV imports, ABM databases,
 * recruiter talent pools) where you don't need contact info per lead —
 * typically a pre-campaign hygiene step before a human-led follow-up.
 */
export const salesFastEnrichmentTemplate: TemplateDefinition = {
    id: 'sales-fast-enrichment',
    name: 'Fast Enrichment (API)',
    description:
        'Same as Stealth Enrichment but ~50x faster: uses LinkedIn\'s internal Voyager API to read profile data without loading the full page. Best for 500+ lead lists where you need name/headline/company/location but don\'t need email/phone.',
    useCase: 'Bulk pre-campaign CRM hygiene — enrich 100s of leads in minutes instead of hours.',
    bestFor:
        'Best for: SDR/AE teams enriching a 500+ lead list before a launch. NOT recommended for: cases where you need email/phone (use the DOM Stealth Enrichment instead, or layer an email-finder step).',
    recommendedFor: [
        'Bulk list hygiene (500+ leads)',
        'Pre-campaign CRM enrichment',
        'ABM list building at scale',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'sales',
    icon: '⚡',
    color: 'from-emerald-500 to-teal-600',
    durationDays: 1,
    stepCount: 2,
    delayCount: 0,
    aiStrategyHint: {
        objective:
            'Bulk-enrich CRM rows with name, headline, company, and location data at 50x the speed of the DOM-based Stealth Enrichment.',
        description:
            'No outreach. Uses Voyager API to read profile data in ~300ms per lead. No DMs sent, no invites sent, no connection requests. Outputs ready for a human-led campaign or a CRM sync.',
        cta: 'enrich at scale',
        toneOverride: 'neutral',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            // PROFILE_VISIT_VOYAGER → uses /voyager/api/identity/dash/profiles/...
            // ~300ms per lead, returns name/headline/summary/location/photo
            node('n1', 100, 'ACTION', 'PROFILE_VISIT_VOYAGER', 'Fast Enrich (API)', {
                enrichCompany: true, enrichAbout: true, enrichContact: false, enrichPosts: false,
            }),
            node('end_ok', 200, 'ACTION', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'), edge('n1', 'end_ok'),
        ],
    },
};

/**
 * Inbox Sync (API mode) — replaces the DOM-based inbox-sync node with the
 * Voyager GraphQL fast path. Use as a standalone node in any workflow that
 * wants to read inbox messages without doing a full DOM navigation.
 *
 * Performance: ~300ms for thread list + ~300ms per thread for full message
 * bodies. A 50-thread inbox takes ~16s vs ~5-8min for DOM scrape.
 */
export const inboxSyncVoyagerTemplate: TemplateDefinition = {
    id: 'inbox-sync-voyager',
    name: 'Inbox Sync (API)',
    description:
        'Sync all inbox conversations via LinkedIn\'s internal Voyager API. Reads thread list and full message bodies in ~16 seconds for a 50-thread inbox — no DOM scraping, no navigation.',
    useCase: 'Read inbox messages to detect replies, populate inbox UI, or feed reply-pause logic. Same output shape as the DOM Inbox Sync but 10-30x faster.',
    bestFor:
        'Best for: any workflow that needs to check for replies or sync inbox state. Can be added to a campaign that runs periodically (daily cron) to keep the inbox view fresh.',
    recommendedFor: [
        'Reply detection for paused leads',
        'Inbox UI population',
        'Reply-pause invariant enforcement',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'sales',
    icon: '📥',
    color: 'from-sky-500 to-indigo-600',
    durationDays: 1,
    stepCount: 1,
    delayCount: 0,
    aiStrategyHint: {
        objective:
            'Sync the user\'s LinkedIn inbox via Voyager API and persist any new replies to the CRM so reply-pause logic works correctly.',
        description:
            'Reads thread list + full message bodies via internal API. No UI interaction. Detects new replies from leads in active campaigns and marks those leads as REPLIED.',
        cta: 'sync inbox',
        toneOverride: 'neutral',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Manual / Cron'),
            node('n1', 100, 'ACTION', 'INBOX_SYNC_VOYAGER', 'Sync Inbox (API)', { maxThreads: 50 }),
            node('end_ok', 200, 'ACTION', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'), edge('n1', 'end_ok'),
        ],
    },
};
