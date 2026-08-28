import { prisma } from '@repo/db';

// Lead-run state machine. The DB column `CampaignLeadProgress.status` is
// the single source of truth for where a lead is in its sequence — every
// mutation goes through `transitionLead` so illegal transitions throw at
// the seam rather than corrupting state.
//
// Terminal states (REPLIED / COMPLETED / STALLED / FAILED) have empty
// successor lists: once a lead is terminal, the engine and cron skip it.
//
// DEFERRED is non-terminal — the cron scheduler picks DEFERRED rows whose
// `nextRetryAt` has matured and the engine flips them back to IN_PROGRESS
// when it picks the lead up again.

export type LeadRunStatus =
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'DEFERRED'
    | 'REPLIED'
    | 'COMPLETED'
    | 'STALLED'
    | 'FAILED';

const ALLOWED: Record<LeadRunStatus, LeadRunStatus[]> = {
    PENDING:     ['IN_PROGRESS', 'DEFERRED', 'COMPLETED', 'FAILED', 'REPLIED'],
    IN_PROGRESS: ['DEFERRED', 'REPLIED', 'COMPLETED', 'FAILED'],
    DEFERRED:    ['IN_PROGRESS', 'COMPLETED', 'REPLIED', 'STALLED', 'FAILED'],
    REPLIED:     [],
    COMPLETED:   [],
    STALLED:     [],
    FAILED:      [],
};

const TERMINAL: ReadonlySet<LeadRunStatus> = new Set([
    'REPLIED', 'COMPLETED', 'STALLED', 'FAILED',
]);

export function isTerminal(s: LeadRunStatus): boolean {
    return TERMINAL.has(s);
}

// Soft ceiling on consecutive deferrals before a lead is marked STALLED.
// Anything above this is almost certainly stuck (cap-exhausted account,
// chronic off-hours, etc.) and should surface in the UI instead of
// silently rescheduling forever.
const MAX_DEFERRALS = 3;

export interface TransitionPatch {
    /** Current node index to persist (engine progress pointer). */
    currentNodeIndex?: number;
    /** When DEFERRED, when the cron should retry. Required for DEFERRED. */
    nextRetryAt?: Date | null;
    /** Free-form reason for analytics / UI ("daily_cap", "off_hours", ...). */
    reason?: string;
    /** connectionStatus passthrough (legacy column, still used by nodes). */
    connectionStatus?: string;
}

export interface TransitionResult {
    progressId: string;
    from: LeadRunStatus;
    to: LeadRunStatus;
    deferralCount: number;
    terminalAt: Date | null;
}

/**
 * Move a lead's run-status through the state machine.
 *
 * - Validates the transition against `ALLOWED`. Illegal transitions throw.
 * - Auto-promotes DEFERRED → STALLED when deferralCount would exceed
 *   MAX_DEFERRALS (transparently — caller asks for DEFERRED, gets STALLED).
 * - Stamps `terminalAt` on terminal states.
 * - Upserts the row by (campaignId, leadId) so it works from cold-start
 *   (engine first touch on a lead with no progress row) and from update.
 * - Recomputes parent campaign status when a terminal transition lands.
 */
export async function transitionLead(
    campaignId: string,
    leadId: string,
    to: LeadRunStatus,
    patch: TransitionPatch = {},
): Promise<TransitionResult> {
    const current = await prisma.campaignLeadProgress.findUnique({
        where: { campaignId_leadId: { campaignId, leadId } },
        select: {
            id: true, status: true, deferralCount: true,
            currentNodeIndex: true, connectionStatus: true,
        },
    });

    const from: LeadRunStatus = (current?.status as LeadRunStatus) || 'PENDING';

    // If the row doesn't exist yet, allow any transition out of PENDING.
    if (!ALLOWED[from].includes(to) && from !== to) {
        throw new Error(
            `Illegal lead transition ${from} → ${to} (campaign=${campaignId} lead=${leadId})`
        );
    }

    let effectiveTo: LeadRunStatus = to;
    let deferralCount = current?.deferralCount ?? 0;

    if (to === 'DEFERRED') {
        deferralCount += 1;
        if (deferralCount > MAX_DEFERRALS) {
            effectiveTo = 'STALLED';
        }
    }

    const isNowTerminal = TERMINAL.has(effectiveTo);
    const terminalAt = isNowTerminal ? new Date() : null;

    const data = {
        status: effectiveTo,
        statusReason: patch.reason ?? null,
        deferralCount,
        nextRetryAt: effectiveTo === 'DEFERRED'
            ? (patch.nextRetryAt ?? null)
            : null,
        needsRetry: effectiveTo === 'DEFERRED',
        currentNodeIndex: patch.currentNodeIndex
            ?? current?.currentNodeIndex
            ?? 0,
        connectionStatus: patch.connectionStatus
            ?? current?.connectionStatus
            ?? 'not_connected',
        terminalAt,
        completedAt: effectiveTo === 'COMPLETED' ? new Date() : undefined,
        updatedAt: new Date(),
    };

    const row = await prisma.campaignLeadProgress.upsert({
        where: { campaignId_leadId: { campaignId, leadId } },
        create: { campaignId, leadId, ...data },
        update: data,
    });

    // Project the new execution state onto the coarse enums (the single writer).
    // Awaited so dashboards/copilot never read a stale coarse status right after a
    // transition; monotonic + idempotent so this is always safe.
    await syncLeadStatus(campaignId, leadId).catch(() => {});

    if (isNowTerminal) {
        // Fire-and-forget — campaign-level rollup shouldn't block the engine.
        recomputeCampaignStatus(campaignId).catch(err =>
            console.error(`[lifecycle] recompute failed for ${campaignId}:`, err.message)
        );

        // Surface terminal lifecycle to the CRM event bus. REPLIED and
        // COMPLETED map to user-visible CRM activity; STALLED/FAILED are
        // infra concerns and intentionally excluded.
        if (effectiveTo === 'REPLIED' || effectiveTo === 'COMPLETED') {
            (async () => {
                try {
                    const cl = await prisma.campaign.findUnique({
                        where: { id: campaignId },
                        select: { userId: true },
                    });
                    if (!cl) return;
                    const { emitCrmEvent } = await import('../../services/crm-events');
                    await emitCrmEvent({
                        event: effectiveTo === 'REPLIED' ? 'lead.replied' : 'lead.completed',
                        userId: cl.userId,
                        campaignId,
                        leadId,
                        meta: { reason: patch.reason },
                    });
                } catch (err: any) {
                    console.error(`[lifecycle] crm emit failed: ${err.message}`);
                }
            })();
        }
    }

    return {
        progressId: row.id,
        from,
        to: effectiveTo,
        deferralCount,
        terminalAt,
    };
}

/**
 * Recompute Campaign.status from lead aggregates.
 *
 * - If at least one lead is still non-terminal → leave status alone (engine
 *   manages ACTIVE vs PAUSED separately).
 * - If every lead is terminal → flip to COMPLETED, unless it's already
 *   PAUSED or CANCELLED (those are user-controlled and shouldn't be
 *   auto-overwritten).
 *
 * This is the ONLY place that should auto-flip a campaign to COMPLETED.
 */
export async function recomputeCampaignStatus(campaignId: string): Promise<void> {
    const counts = await prisma.campaignLeadProgress.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: { _all: true },
    });

    const totalLeads = await prisma.campaignLead.count({ where: { campaignId } });
    const progressRows = counts.reduce((s, c) => s + c._count._all, 0);
    const terminalRows = counts
        .filter(c => isTerminal(c.status as LeadRunStatus))
        .reduce((s, c) => s + c._count._all, 0);

    // Need a progress row for every CampaignLead AND every progress row
    // terminal. Leads without a progress row are implicitly PENDING.
    if (progressRows < totalLeads) return;
    if (terminalRows < progressRows) return;

    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
    });
    if (!campaign) return;
    if (campaign.status === 'PAUSED' || campaign.status === 'CANCELLED') return;
    if (campaign.status === 'COMPLETED') return;

    const completed = await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
        select: { userId: true },
    });
    console.log(`[lifecycle] campaign ${campaignId} → COMPLETED (all ${terminalRows} leads terminal)`);

    // Promote the user's next queued campaign, if any. Lazy-imported to
    // avoid the worker → engine → worker import cycle at module load.
    try {
        const { promoteNextQueuedCampaign } = await import('../../services/campaign-queue.service');
        await promoteNextQueuedCampaign(completed.userId);
    } catch (err: any) {
        console.error(`[lifecycle] promotion failed for user ${completed.userId}:`, err.message);
    }
}

// ─── Coarse-status projection (single source of truth) ───────────────────────
//
// The two coarse enums the dashboard + copilot count from — CampaignLead.status
// (per-campaign) and Lead.status (global) — are DERIVED from the execution truth,
// never written independently. Execution truth per (campaign, lead) is:
//   • CampaignLeadProgress.status === 'REPLIED'      → REPLIED   (via transitionLead)
//   • CampaignLeadProgress.connectionStatus==='connected' → CONNECTED (via the connect/check nodes)
//   • otherwise                                      → PENDING   (in a campaign, not yet connected)
// syncLeadStatus() is the ONLY writer of both coarse fields. Every place that used
// to poke Lead.status / CampaignLead.status directly now calls this instead, so the
// coarse view can never drift from the execution view again.

export type CoarseStatus = 'IMPORTED' | 'PENDING' | 'CONNECTED' | 'REPLIED' | 'BOUNCED';

// Monotonic rank: a lead only ever moves FORWARD (a reply must never be downgraded
// to a mere connection, etc.). IMPORTED/BOUNCED share rank 0 (pre-outreach).
const COARSE_RANK: Record<CoarseStatus, number> = { IMPORTED: 0, BOUNCED: 0, PENDING: 1, CONNECTED: 2, REPLIED: 3 };

// PURE: the coarse status implied by one campaign-lead's execution signals.
export function coarseLeadStatus(sig: { replied: boolean; connected: boolean }): CoarseStatus {
    if (sig.replied) return 'REPLIED';
    if (sig.connected) return 'CONNECTED';
    return 'PENDING';
}

// PURE: the highest-rank status across a lead's campaign rows (the global rollup).
export function rollupLeadStatus(statuses: CoarseStatus[]): CoarseStatus {
    let best: CoarseStatus = 'IMPORTED';
    for (const s of statuses) if ((COARSE_RANK[s] ?? 0) > COARSE_RANK[best]) best = s;
    return best;
}

// Statuses strictly below `target` by rank — the WHERE guard that makes every
// write monotonic (and race-free: the guard is in the query, not a read-modify-write).
function statusesBelow(target: CoarseStatus): CoarseStatus[] {
    const r = COARSE_RANK[target];
    return (Object.keys(COARSE_RANK) as CoarseStatus[]).filter((s) => COARSE_RANK[s] < r);
}

/**
 * Project the execution truth onto the coarse enums for one (campaign, lead).
 * The SINGLE writer of CampaignLead.status and Lead.status. Monotonic (upgrade
 * only) and idempotent, so it's safe to call after any execution-state change
 * (a transition, a connection check, a reply). connectionStatus / connectionDegree
 * remain owned by their write-only-when-confident callers — this reads them, never
 * writes them.
 */
export async function syncLeadStatus(campaignId: string, leadId: string): Promise<void> {
    // Reply truth = an inbound message exists (lead-global: they replied to the
    // user). This is robust to leads that reply AFTER their sequence went terminal,
    // which the run-state machine can't represent. Connection truth = the progress
    // row's connectionStatus.
    const [prog, repliedMsg] = await Promise.all([
        prisma.campaignLeadProgress.findUnique({
            where: { campaignId_leadId: { campaignId, leadId } },
            select: { status: true, connectionStatus: true },
        }).catch(() => null),
        prisma.message.findFirst({ where: { leadId, direction: 'RECEIVED' }, select: { id: true } }).catch(() => null),
    ]);

    const target = coarseLeadStatus({
        replied: prog?.status === 'REPLIED' || !!repliedMsg,
        connected: prog?.connectionStatus === 'connected',
    });

    // Per-campaign: upgrade this campaign-lead toward the target (never downgrade).
    await prisma.campaignLead.updateMany({
        where: { campaignId, leadId, status: { in: statusesBelow(target) } },
        data: { status: target },
    }).catch(() => {});

    // Global rollup: Lead.status = the furthest-along status across ALL the lead's
    // campaigns (a lead can be in many). Upgrade-only, same guard.
    const rows = await prisma.campaignLead.findMany({ where: { leadId }, select: { status: true } }).catch(() => [] as { status: string }[]);
    const rolled = rollupLeadStatus(rows.map((r) => r.status as CoarseStatus));
    await prisma.lead.updateMany({
        where: { id: leadId, status: { in: statusesBelow(rolled) } },
        data: { status: rolled },
    }).catch(() => {});
}

/**
 * @deprecated Thin alias for {@link syncLeadStatus}. Kept so existing call sites
 * ("this lead just connected") read naturally; the projection derives CONNECTED
 * from the connectionStatus the caller already wrote. Prefer syncLeadStatus.
 */
export async function markLeadConnected(campaignId: string, leadId: string): Promise<void> {
    await syncLeadStatus(campaignId, leadId);
}
