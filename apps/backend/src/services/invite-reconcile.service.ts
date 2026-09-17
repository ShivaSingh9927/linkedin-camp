/**
 * Keeps outstanding invitations honest.
 *
 * THE BUG THIS FIXES. `CampaignLeadProgress.connectionStatus` is only written
 * while a campaign is running: connect sets 'pending', and a later
 * CHECK_CONNECTION step may promote it to 'connected'. A lead whose sequence
 * has FINISHED is never looked at again — so an invite accepted a week after
 * the campaign ended stays 'pending' in our database forever.
 *
 * That used to be cosmetic. It isn't any more: the invite ramp
 * (campaign-engine/safety/rampup.ts) derives its acceptance rate from exactly
 * these rows, so stale 'pending' makes a healthy account look ignored and
 * halves its daily allowance. The number that throttles outreach has to be
 * measured, not remembered.
 *
 * It also matters on its own terms. LinkedIn names "many of your invitations
 * have been ignored, left pending, or marked as spam" as a restriction trigger,
 * and warns that too many outstanding invitations can cost up to a month. You
 * cannot manage a number you aren't measuring.
 *
 * BROWSER-FREE by design: the dash topcard read works over plain HTTP with the
 * saved cookies and the pinned proxy (see voyager-api.service), so a daily
 * sweep across every user costs no Chromium and takes no browser slot.
 */

import { prisma } from '@repo/db';
import { getBrowserlessVoyagerContext, getMemberRelationship } from './voyager-api.service';
import { extractSlug } from '../campaign-engine/connection-state';
import { syncLeadStatus } from '../campaign-engine/safety/lifecycle';

export interface ReconcileResult {
    checked: number;
    accepted: number;
    /** Invite no longer exists on LinkedIn: withdrawn, expired, or declined. */
    vanished: number;
    stillPending: number;
    /** Couldn't reach LinkedIn for this row — left untouched, never guessed. */
    unknown: number;
    /** Age in days of the oldest invite still outstanding after this sweep. */
    oldestPendingDays: number | null;
}

const EMPTY: ReconcileResult = {
    checked: 0, accepted: 0, vanished: 0, stillPending: 0, unknown: 0, oldestPendingDays: null,
};

/**
 * Injection seam for the two LinkedIn reads. Production never passes these —
 * they exist because esbuild emits module exports as non-configurable getters,
 * so a test cannot stub the imports, and the decision logic here (especially
 * "a failed read must not clear a real invite") is worth testing without a
 * network.
 */
export interface ReconcileDeps {
    getContext: typeof getBrowserlessVoyagerContext;
    getRelationship: typeof getMemberRelationship;
}

/**
 * Re-check this user's 'pending' invites against LinkedIn and correct the rows.
 *
 * `minAgeHours` skips invites sent moments ago — the relationship read is
 * eventually consistent, and a just-sent invite can still read as NoInvitation.
 * `limit` bounds the sweep so one user with a huge backlog can't monopolise the
 * nightly run.
 */
export async function reconcilePendingInvites(
    userId: string,
    opts: { minAgeHours?: number; limit?: number; deps?: ReconcileDeps } = {},
): Promise<ReconcileResult> {
    const getContext = opts.deps?.getContext ?? getBrowserlessVoyagerContext;
    const getRelationship = opts.deps?.getRelationship ?? getMemberRelationship;
    const minAgeHours = opts.minAgeHours ?? 12;
    const limit = opts.limit ?? 200;

    // Explicit campaignId list rather than a `Campaign: { userId }` relation
    // filter — Prisma relation casing differs between local tsc and the prod
    // client, and a filter that throws in prod would make this a silent no-op.
    const campaigns = await prisma.campaign
        .findMany({ where: { userId }, select: { id: true } })
        .catch(() => [] as Array<{ id: string }>);
    if (!campaigns.length) return { ...EMPTY };

    const rows = await prisma.campaignLeadProgress.findMany({
        where: {
            campaignId: { in: campaigns.map(c => c.id) },
            connectionStatus: 'pending',
            updatedAt: { lt: new Date(Date.now() - minAgeHours * 3_600_000) },
        },
        orderBy: { updatedAt: 'asc' },   // oldest invites first — they matter most
        take: limit,
        select: { id: true, campaignId: true, leadId: true, updatedAt: true },
    }).catch(() => [] as any[]);

    if (!rows.length) return { ...EMPTY };

    const leads = await prisma.lead.findMany({
        where: { id: { in: rows.map((r: any) => r.leadId) } },
        select: { id: true, linkedinUrl: true, firstName: true },
    }).catch(() => [] as any[]);
    const leadById = new Map(leads.map((l: any) => [l.id, l]));

    const out: ReconcileResult = { ...EMPTY };
    let oldestPendingAt: Date | null = null;
    // Name the rows we couldn't read. "4 unknown" alone is undiagnosable, and
    // an unknown that persists across nights is a different problem (dead
    // profile, changed vanity, blocked read) from a transient one.
    const unreadable: string[] = [];

    // Null when the session/proxy snapshot can't build a context. Bail rather
    // than fall through — every row would read "unknown" and we'd have burned
    // the sweep's budget learning nothing.
    const voyager = await getContext(userId);
    if (!voyager) {
        console.log(`[INVITE-RECONCILE] user ${userId}: no browser-free context (session/proxy) — skipping.`);
        return { ...EMPTY, unknown: rows.length };
    }
    const { ctx, dispose } = voyager;
    try {
        for (const row of rows) {
            const lead = leadById.get(row.leadId);
            const slug = lead?.linkedinUrl ? extractSlug(lead.linkedinUrl) : null;
            if (!slug) { out.unknown++; unreadable.push(`${lead?.firstName || row.leadId}:no-slug`); continue; }

            out.checked++;
            const rel = await getRelationship(userId, slug, null, ctx).catch(() => null);

            // No answer means no change. Writing 'not_connected' on a failed
            // read would silently delete a real outstanding invite from our
            // count and hand the ramp a flattering acceptance rate.
            if (!rel || (rel.distance == null && rel.pendingInvite == null)) {
                out.unknown++;
                unreadable.push(slug);
                continue;
            }

            if (rel.connected) {
                out.accepted++;
                await prisma.campaignLeadProgress.update({
                    where: { id: row.id },
                    data: { connectionStatus: 'connected', lastConnectionCheck: new Date() },
                }).catch(() => {});
                await prisma.lead.update({
                    where: { id: row.leadId }, data: { connectionDegree: 1 },
                }).catch(() => {});
                await syncLeadStatus(row.campaignId, row.leadId).catch(() => {});
                continue;
            }

            if (rel.pendingInvite === false) {
                // Not connected AND no invite on record: withdrawn, expired or
                // declined. Either way it is no longer outstanding.
                out.vanished++;
                await prisma.campaignLeadProgress.update({
                    where: { id: row.id },
                    data: { connectionStatus: 'not_connected', lastConnectionCheck: new Date() },
                }).catch(() => {});
                await syncLeadStatus(row.campaignId, row.leadId).catch(() => {});
                continue;
            }

            out.stillPending++;
            if (!oldestPendingAt || row.updatedAt < oldestPendingAt) oldestPendingAt = row.updatedAt;
        }
    } finally {
        await dispose().catch(() => {});
    }

    out.oldestPendingDays = oldestPendingAt
        ? Math.floor((Date.now() - oldestPendingAt.getTime()) / 86_400_000)
        : null;

    console.log(`[INVITE-RECONCILE] user ${userId}: checked ${out.checked} — `
        + `${out.accepted} accepted, ${out.vanished} gone, ${out.stillPending} still pending, ${out.unknown} unknown`
        + `${out.oldestPendingDays !== null ? ` (oldest ${out.oldestPendingDays}d)` : ''}.`);
    if (unreadable.length) {
        console.log(`[INVITE-RECONCILE] unreadable: ${unreadable.slice(0, 8).join(', ')}`
            + `${unreadable.length > 8 ? ` (+${unreadable.length - 8} more)` : ''}`);
    }

    return out;
}

/** How many invitations this user currently has outstanding, per our records. */
export async function countOutstandingInvites(userId: string): Promise<number> {
    const campaigns = await prisma.campaign
        .findMany({ where: { userId }, select: { id: true } })
        .catch(() => [] as Array<{ id: string }>);
    if (!campaigns.length) return 0;
    return prisma.campaignLeadProgress.count({
        where: { campaignId: { in: campaigns.map(c => c.id) }, connectionStatus: 'pending' },
    }).catch(() => 0);
}
