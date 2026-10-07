// Make Lead.connectionDegree mean something.
//
// On 2026-10-07 the column said 6 leads were 1st-degree while LinkedIn's own
// connections list returned 57. Lead SELECTION is built on this field, and it
// was wrong for 2 of the 6 picked for a "message my connections" campaign —
// Disha and Padmaja were 2nd-degree. The campaign's runtime gate caught them,
// so nothing went out wrongly, but only because a later check did the work this
// column was supposed to have done.
//
// The connections list is authoritative for "is 1st-degree". It is NOT
// authoritative for "is 2nd or 3rd", so a lead that is absent from it is set to
// unknown (null) rather than demoted to a degree we never observed.

import { prisma } from '@repo/db';
import { getAllConnections, getConnectionsSummary, getBrowserlessVoyagerContext } from './voyager-api.service';
import { normName, extractVanityFromUrl } from './lead-match';

export interface ReconcileResult {
    userId: string;
    ok: boolean;
    error?: string;
    /** LinkedIn's own connection count, from connectionsSummary. */
    reported: number;
    /** How many we could actually read. */
    fetched: number;
    /** Whether the list is complete enough to trust an ABSENCE from it. */
    complete: boolean;
    promoted: number;
    cleared: number;
    unchanged: number;
}

export async function reconcileConnectionDegrees(userId: string): Promise<ReconcileResult> {
    const base: ReconcileResult = {
        userId, ok: false, reported: 0, fetched: 0, complete: false,
        promoted: 0, cleared: 0, unchanged: 0,
    };

    const bl = await getBrowserlessVoyagerContext(userId);
    const apiRequest = bl?.ctx;
    try {
        const list = await getAllConnections(userId, null as any, apiRequest);
        if (!list.ok || !Array.isArray(list.data)) {
            return { ...base, error: (list as any).error || 'connections read failed' };
        }
        const conns = list.data;
        base.fetched = conns.length;

        // LinkedIn's own count. getAllConnections drops entries whose
        // miniProfile is missing from `included`, so the fetched list can be
        // short — and demoting on a short list would invent data.
        const summary = await getConnectionsSummary(userId, null as any, apiRequest).catch(() => null);
        base.reported = summary?.ok ? summary.data.numConnections : 0;
        base.complete = base.reported > 0 && conns.length >= base.reported;

        // Two indexes, because a connection entry can carry a null
        // publicIdentifier — the same reason the inbox matcher needs both.
        const slugs = new Set<string>();
        const names = new Set<string>();
        for (const c of conns) {
            if (c.publicIdentifier) slugs.add(c.publicIdentifier.toLowerCase());
            const n = normName(`${c.firstName} ${c.lastName}`);
            if (n) names.add(n);
        }

        const leads = await prisma.lead.findMany({
            where: { userId },
            select: { id: true, firstName: true, lastName: true, linkedinUrl: true, connectionDegree: true },
        });

        for (const l of leads) {
            const slug = extractVanityFromUrl(l.linkedinUrl || '')?.toLowerCase();
            const isConnection = (slug && slugs.has(slug))
                || names.has(normName(`${l.firstName || ''} ${l.lastName || ''}`));

            if (isConnection) {
                if (l.connectionDegree === 1) { base.unchanged++; continue; }
                await prisma.lead.update({ where: { id: l.id }, data: { connectionDegree: 1 } });
                base.promoted++;
                continue;
            }

            // Absent from the list. Only act on that when the list is complete,
            // and then set UNKNOWN rather than a degree we never saw — "not a
            // connection" does not tell us whether they are 2nd or 3rd.
            if (l.connectionDegree === 1 && base.complete) {
                await prisma.lead.update({ where: { id: l.id }, data: { connectionDegree: null } });
                base.cleared++;
                continue;
            }
            base.unchanged++;
        }

        return { ...base, ok: true };
    } finally {
        await bl?.dispose().catch(() => {});
    }
}
