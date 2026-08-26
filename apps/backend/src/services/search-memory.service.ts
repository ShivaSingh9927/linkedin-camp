// search-memory.service.ts — the discovery/variety engine's durable substrate.
//
// The copilot's people-search used to remember nothing across a reload (the
// frontend's `seenUrlsRef` Set died with the tab). This module gives it a real
// memory, in the DB (NOT the chat transcript, which is summarized and forgets):
//
//   • SeenProfile — every profile ever surfaced to the user. Cross-session dedup
//     so the same faces never burn a second search. Skipped profiles roll off a
//     30-day window (people change roles); imported profiles are deduped forever
//     (they're already Leads).
//   • SearchQuery — one row per distinct boolean query: how deep it's been paged,
//     how many results it surfaced, how many converted to imports, and whether
//     it's mined out. This is what saturation detection + rotation read.
//
// INVARIANT: like query-tools, the READ helpers here (getSearchCoverage /
// getTriedAngles) are strictly read-only. The write helpers (recordSearchPage /
// markImported) run only on the already-authorized search + import paths — a
// search the user spent budget on, an import the user confirmed — never
// speculatively.

import { prisma } from '@repo/db';
import type { SearchPerson, SearchFilters } from './people-search.service';

// Skipped-but-seen profiles resurface after this many days (they may have
// changed jobs / relevance). Imported profiles dedup permanently via Lead.
const SEEN_WINDOW_DAYS = 30;

// Match Lead.linkedinUrl canonicalization (see lead.controller.normalizeLinkedinUrl)
// so dedup lines up across the two stores: strip query/hash + trailing slashes.
export function normUrl(raw?: string | null): string {
    if (!raw) return '';
    let u = raw.trim().split('?')[0].split('#')[0];
    u = u.replace(/\/+$/, '');
    return u;
}

// Canonical key for a query so the same search across sessions maps to ONE
// SearchQuery row: lowercased, whitespace-collapsed keywords + sorted filter
// values. Page is deliberately excluded — pagination is depth WITHIN a query.
export function canonicalQueryKey(keywords: string, filters?: SearchFilters): string {
    const kw = (keywords || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const f = filters || {};
    const facets = [
        f.title ? `t:${f.title.toLowerCase().trim()}` : '',
        f.location ? `l:${f.location.toLowerCase().trim()}` : '',
        f.industry ? `i:${f.industry.toLowerCase().trim()}` : '',
        f.degrees?.length ? `d:${[...f.degrees].sort().join(',')}` : '',
    ].filter(Boolean).sort().join('|');
    return facets ? `${kw}::${facets}` : kw;
}

export type SaturationState = 'active' | 'saturating' | 'exhausted';

export interface SaturationSignal {
    state: SaturationState;
    newRatio: number;   // fresh ÷ what LinkedIn returned this page
    page: number;
    freshCount: number;
    pageCount: number;  // rows LinkedIn returned before dedup
}

export interface RecordResult {
    fresh: SearchPerson[];
    saturation: SaturationSignal;
}

// The window boundary as a Date (backend code — new Date() is fine here; the
// Date.now() ban only applies to workflow scripts).
function windowStart(): Date {
    return new Date(Date.now() - SEEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Given a raw page of LinkedIn results, dedup against what the user has already
 * seen (30-day window) or imported (Lead, permanent), record the freshly-shown
 * profiles + update the query's depth/state, and return the fresh subset plus a
 * saturation signal. Called from searchLeads after a search actually ran.
 */
export async function recordSearchPage(
    userId: string,
    args: { keywords: string; label?: string; filters?: SearchFilters; page: number; people: SearchPerson[] },
): Promise<RecordResult> {
    const { keywords, filters, page } = args;
    const people = args.people || [];
    const pageCount = people.length;
    const queryKey = canonicalQueryKey(keywords, filters);
    const now = new Date();

    // Normalized URLs for the returned people (skip any without a URL).
    const withUrl = people
        .map((p) => ({ p, url: normUrl(p.linkedinUrl) }))
        .filter((x) => x.url.length > 0);
    const urls = withUrl.map((x) => x.url);

    // Already-imported (Lead) → permanent dedup. Already-seen within the window
    // (SeenProfile) → time-boxed dedup. Union of the two is what we drop.
    const [leadRows, seenRows] = urls.length
        ? await Promise.all([
            prisma.lead.findMany({ where: { userId, linkedinUrl: { in: urls } }, select: { linkedinUrl: true } }),
            prisma.seenProfile.findMany({
                where: { userId, linkedinUrl: { in: urls }, seenAt: { gt: windowStart() } },
                select: { linkedinUrl: true },
            }),
        ])
        : [[], []];
    const blocked = new Set<string>([
        ...leadRows.map((r) => r.linkedinUrl),
        ...seenRows.map((r) => r.linkedinUrl),
    ]);

    const freshPairs = withUrl.filter((x) => !blocked.has(x.url));
    const fresh = freshPairs.map((x) => x.p);
    const freshCount = fresh.length;

    // Record the freshly-shown profiles (upsert so a stale >30-day row gets its
    // seenAt bumped — showing it now restarts its window).
    if (freshPairs.length) {
        await Promise.all(freshPairs.map((x) =>
            prisma.seenProfile.upsert({
                where: { userId_linkedinUrl: { userId, linkedinUrl: x.url } },
                create: { userId, linkedinUrl: x.url, queryKey, seenAt: now },
                update: { seenAt: now, queryKey },
            }),
        ));
    }

    const saturation = computeSaturation(page, pageCount, freshCount);

    // Upsert the query row. Preserve the ORIGINAL label on repeat runs (a
    // "show more" carries only keywords); accumulate seenCount + max page.
    const existing = await prisma.searchQuery.findUnique({
        where: { userId_queryKey: { userId, queryKey } },
        select: { seenCount: true, maxPageReached: true },
    });
    await prisma.searchQuery.upsert({
        where: { userId_queryKey: { userId, queryKey } },
        create: {
            userId, queryKey,
            label: (args.label || keywords).slice(0, 120),
            keywords,
            filters: (filters as any) ?? undefined,
            maxPageReached: page,
            seenCount: freshCount,
            state: saturation.state,
            lastRunAt: now,
        },
        update: {
            maxPageReached: Math.max(existing?.maxPageReached ?? 1, page),
            seenCount: (existing?.seenCount ?? 0) + freshCount,
            state: saturation.state,
            lastRunAt: now,
        },
    });

    return { fresh, saturation };
}

// Saturation heuristic — "is this vein mined out?" from the page's new-ratio and
// depth. Thresholds are deliberately simple + tunable; the UI only branches on
// `state` (active → keep paging, saturating → warn, exhausted → rotate).
export function computeSaturation(page: number, pageCount: number, freshCount: number): SaturationSignal {
    const newRatio = pageCount > 0 ? freshCount / pageCount : 0;
    let state: SaturationState;
    if (pageCount === 0) state = 'exhausted';                 // LinkedIn has no more rows
    else if (page >= 100) state = 'exhausted';                // ~1000-result display cap
    else if (page > 1 && freshCount === 0) state = 'exhausted'; // a whole page we've already seen
    else if (newRatio < 0.4 || page >= 20) state = 'saturating';
    else state = 'active';
    return { state, newRatio: Math.round(newRatio * 100) / 100, page, freshCount, pageCount };
}

/**
 * Flag surfaced profiles as imported (permanent dedup + import-rate math) and
 * attribute the import to the query that first surfaced each one. Called from
 * the import path with the leads that actually landed. Also backfills a
 * SeenProfile row for imports that never came through search (e.g. the Chrome
 * extension) so coverage + dedup stay complete.
 */
export async function markImported(userId: string, rawUrls: Array<string | null | undefined>): Promise<void> {
    const urls = Array.from(new Set(rawUrls.map(normUrl).filter(Boolean)));
    if (!urls.length) return;

    const rows = await prisma.seenProfile.findMany({
        where: { userId, linkedinUrl: { in: urls } },
        select: { linkedinUrl: true, queryKey: true, imported: true },
    });

    // Attribute NEW imports (were imported:false) to their originating query.
    const byQuery: Record<string, number> = {};
    for (const r of rows) {
        if (!r.imported && r.queryKey) byQuery[r.queryKey] = (byQuery[r.queryKey] || 0) + 1;
    }

    await prisma.seenProfile.updateMany({ where: { userId, linkedinUrl: { in: urls } }, data: { imported: true } });

    // Imports with no SeenProfile yet (extension / CSV path) — record them as
    // seen+imported so they dedup permanently and count toward import rate.
    const existing = new Set(rows.map((r) => r.linkedinUrl));
    const missing = urls.filter((u) => !existing.has(u));
    if (missing.length) {
        await prisma.seenProfile.createMany({
            data: missing.map((u) => ({ userId, linkedinUrl: u, imported: true })),
            skipDuplicates: true,
        });
    }

    for (const [queryKey, n] of Object.entries(byQuery)) {
        await prisma.searchQuery.updateMany({ where: { userId, queryKey }, data: { importedCount: { increment: n } } });
    }
}

// ── read-only coverage lookups (for the copilot) ─────────────────────────────

export interface SearchCoverageData {
    totalQueries: number;
    totalSeen: number;
    totalImported: number;
    importRate: number;      // imported ÷ seen (0..1)
    exhausted: string[];     // labels of mined-out veins
    productive: string[];    // labels still returning fresh people
}

// "What have I searched, what's left to mine?" — a small summary for check_status.
export async function getSearchCoverage(userId: string): Promise<SearchCoverageData> {
    const rows = await prisma.searchQuery.findMany({
        where: { userId },
        orderBy: { lastRunAt: 'desc' },
        take: 50,
        select: { label: true, state: true, seenCount: true, importedCount: true },
    });
    const totalSeen = rows.reduce((s, r) => s + r.seenCount, 0);
    const totalImported = rows.reduce((s, r) => s + r.importedCount, 0);
    return {
        totalQueries: rows.length,
        totalSeen,
        totalImported,
        importRate: totalSeen > 0 ? Math.round((totalImported / totalSeen) * 100) / 100 : 0,
        exhausted: rows.filter((r) => r.state === 'exhausted').map((r) => r.label).slice(0, 6),
        productive: rows.filter((r) => r.state !== 'exhausted').map((r) => r.label).slice(0, 6),
    };
}

export interface TriedAngle {
    label: string;
    keywords: string;
    state: string;
}

// The recent boolean angles a user has already run — fed to the query builder so
// rotation proposes a GENUINELY different search instead of a near-duplicate.
export async function getTriedAngles(userId: string, take = 12): Promise<TriedAngle[]> {
    const rows = await prisma.searchQuery.findMany({
        where: { userId },
        orderBy: { lastRunAt: 'desc' },
        take,
        select: { label: true, keywords: true, state: true },
    });
    return rows.map((r) => ({ label: r.label, keywords: r.keywords, state: r.state }));
}
