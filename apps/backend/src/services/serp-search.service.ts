// serp-search.service.ts
//
// Second lead source: LinkedIn profiles discovered through a public search
// engine instead of through LinkedIn's own search.
//
// Why it exists: LinkedIn's monthly Commercial Use Limit caps in-app search at
// ~280/month on a free account, and that ceiling — not our infrastructure — is
// what stops a user prospecting. Engine results don't touch it.
//
// Where it runs: the research-agent service on the db box, which is the only
// place the Lightpanda binary is installed. Deliberately NOT on the worker box:
// that machine is pinned to the dedicated LinkedIn ISP proxy, and keeping
// engine traffic off it means no misconfiguration can route scraping through
// the IP the LinkedIn sessions depend on.
//
// What it cannot know: connection degree, and whether the person still holds
// the job the engine indexed. Degree is handled downstream — smartAudienceRouter
// runs CHECK_CONNECTION before its IF_ELSE and treats null as the cold path.
// Job staleness is NOT yet handled; see the note in people-search.service.

import type { SearchPerson } from './people-search.service';
import { profileSlug } from './linkedin-url';

const RESEARCH_AGENT_URL = process.env.RESEARCH_AGENT_URL || '';
// The engine path is strictly additive: if it's slow, the user still gets their
// LinkedIn results. Keep the budget well under the client's patience.
const SERP_TIMEOUT_MS = parseInt(process.env.SERP_TIMEOUT_MS || '25000', 10);

export interface SerpPerson extends SearchPerson {
    source: 'serp';
}

interface SerpResponse {
    people?: Array<{
        firstName?: string;
        lastName?: string;
        name?: string;
        headline?: string;
        linkedinUrl?: string;
        slug?: string;
    }>;
    query?: string;
    cached?: boolean;
}

// Mirror people-search.service's headline split so a SERP lead and a LinkedIn
// lead carry the same shape into the UI and the importer.
function splitHeadline(headline: string): { jobTitle: string; company: string } {
    const h = (headline || '').replace(/\s+/g, ' ').trim();
    if (!h) return { jobTitle: '', company: '' };
    const at = h.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (at) {
        const jobTitle = at[1].trim();
        const company = at[2].split('|')[0].split('•')[0].trim();
        if (jobTitle.length >= 2 && company.length >= 1) return { jobTitle, company };
    }
    return { jobTitle: h, company: '' };
}

/**
 * Discover profiles via the search engine. Returns [] on any failure — a dead
 * or slow research-agent must never turn a working LinkedIn search into an
 * error, it just means this search had one source instead of two.
 */
export async function searchPeopleViaSerp(opts: {
    keywords: string;
    /** 1-based engine page to start from, so "show more" reads deeper. */
    startPage?: number;
    pages?: number;
    limit?: number;
}): Promise<SerpPerson[]> {
    if (!RESEARCH_AGENT_URL) return [];
    const keywords = (opts.keywords || '').trim();
    if (!keywords) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERP_TIMEOUT_MS);
    try {
        const resp = await fetch(`${RESEARCH_AGENT_URL.replace(/\/$/, '')}/research/people-serp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keywords,
                pages: opts.pages,
                limit: opts.limit,
                startPage: opts.startPage,
            }),
            signal: controller.signal,
        });
        if (!resp.ok) {
            console.warn(`[serp-search] research-agent returned ${resp.status}`);
            return [];
        }
        const json = (await resp.json()) as SerpResponse;
        const rows = Array.isArray(json?.people) ? json.people : [];

        const people: SerpPerson[] = [];
        for (const r of rows) {
            const linkedinUrl = r.linkedinUrl || '';
            // Re-validate here rather than trusting the other service: this is a
            // cross-service boundary and the slug becomes a database key.
            if (!profileSlug(linkedinUrl)) continue;
            const name = (r.name || `${r.firstName || ''} ${r.lastName || ''}`).replace(/\s+/g, ' ').trim();
            if (!name) continue;
            const headline = (r.headline || '').trim();
            const { jobTitle, company } = splitHeadline(headline);
            people.push({
                firstName: r.firstName || name.split(' ')[0] || '',
                lastName: r.lastName || name.split(' ').slice(1).join(' ') || '',
                name,
                headline,
                jobTitle,
                company,
                location: '',
                connectionDegree: null,
                linkedinUrl,
                source: 'serp',
            });
        }
        return people;
    } catch (e: any) {
        const why = e?.name === 'AbortError' ? `timed out after ${SERP_TIMEOUT_MS}ms` : e?.message || String(e);
        console.warn(`[serp-search] skipped: ${why}`);
        return [];
    } finally {
        clearTimeout(timer);
    }
}
