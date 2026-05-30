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
    PENDING:     ['IN_PROGRESS', 'DEFERRED', 'FAILED', 'REPLIED'],
    IN_PROGRESS: ['DEFERRED', 'REPLIED', 'COMPLETED', 'FAILED'],
    DEFERRED:    ['IN_PROGRESS', 'REPLIED', 'STALLED'],
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

    if (isNowTerminal) {
        // Fire-and-forget — campaign-level rollup shouldn't block the engine.
        recomputeCampaignStatus(campaignId).catch(err =>
            console.error(`[lifecycle] recompute failed for ${campaignId}:`, err.message)
        );
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

    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
    });
    console.log(`[lifecycle] campaign ${campaignId} → COMPLETED (all ${terminalRows} leads terminal)`);
}
