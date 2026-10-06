// Which saved lead is this LinkedIn conversation with?
//
// Pure lookup logic, deliberately free of queue, Redis and browser imports so
// it can be exercised without starting the inbox worker — importing the worker
// to test this hung the process at module load, because that module opens a
// Redis connection and a BullMQ queue on import.

import { prisma } from '@repo/db';

export function extractVanityFromUrl(profileUrl: string): string | null {
    if (!profileUrl) return null;
    const m = profileUrl.match(/\/in\/([^/?]+)/);
    return m ? m[1] : null;
}

/**
 * Normalised for comparison: case, accents, emoji and punctuation removed,
 * whitespace collapsed. Lead names are user-supplied and carry all of these
 * (one in this database ends in an emoji).
 */
function normName(v: string | null | undefined): string {
    return (v || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface LeadIndex {
    byVanity: Map<string, any>;
    byName: Map<string, any[]>;
}

/**
 * One query, two lookup keys.
 *
 * The previous match ran two Prisma predicates per thread and BOTH could miss
 * the same lead, which is how a reply went unrecorded on 2026-10-01:
 *
 *   - the vanity predicate compared our stored /in/<slug> against the inbox's
 *     profile URL, but the inbox returns an obfuscated /in/ACoAA… identifier
 *     for many threads, which matches no vanity at all;
 *   - the name predicate asked whether OUR firstName contains THEIRS, which is
 *     directional. LinkedIn had "Veera Durga Sai" / "D" where we had "Veera" /
 *     "Durga Sai D" — the same person, split in a different place, and the
 *     longer string cannot be contained in the shorter one.
 *
 * Comparing whole normalised names is indifferent to where the split falls.
 */
export async function buildLeadIndex(userId: string): Promise<LeadIndex> {
    const leads = await prisma.lead.findMany({
        where: { userId },
        select: { id: true, firstName: true, lastName: true, linkedinUrl: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    });
    const byVanity = new Map<string, any>();
    const byName = new Map<string, any[]>();
    for (const l of leads) {
        const vanity = extractVanityFromUrl(l.linkedinUrl || '');
        if (vanity && !byVanity.has(vanity.toLowerCase())) byVanity.set(vanity.toLowerCase(), l);
        const name = normName(`${l.firstName || ''} ${l.lastName || ''}`);
        if (!name) continue;
        const bucket = byName.get(name) || [];
        bucket.push(l);
        byName.set(name, bucket);
    }
    return { byVanity, byName };
}

export function matchLead(index: LeadIndex, c: any): any | null {
    const vanity = extractVanityFromUrl(c.otherProfileUrl || '');
    // An obfuscated ACoAA… id is not a vanity and must not be matched as one.
    if (vanity && !/^ACoAA/i.test(vanity)) {
        const hit = index.byVanity.get(vanity.toLowerCase());
        if (hit) return hit;
    }

    const name = normName(`${c.otherFirstName || ''} ${c.otherLastName || ''}`);
    if (!name) return null;
    const bucket = index.byName.get(name);
    if (!bucket || !bucket.length) return null;
    if (bucket.length > 1) {
        // Duplicate lead rows for one person are known to exist here. Oldest
        // first is deterministic, so a thread always resolves to the same row
        // rather than scattering a conversation across duplicates.
        console.log(`[INBOX-WORKER] "${name}" matches ${bucket.length} lead rows — using the oldest (${bucket[0].id}).`);
    }
    return bucket[0];
}
