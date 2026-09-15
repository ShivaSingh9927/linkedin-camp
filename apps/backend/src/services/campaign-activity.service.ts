import { prisma } from '@repo/db';

/**
 * What an ACTIVE campaign is actually DOING right now.
 *
 * `Campaign.status` only says whether a campaign is switched on. It cannot
 * distinguish "working through leads" from "every lead is parked at a wait
 * node for the next three days" — both read as ACTIVE. That gap is why a
 * perfectly healthy campaign looked stalled: the UI said ACTIVE, the logs said
 * "Found 0 pending tasks", and nothing explained that the leads were simply
 * waiting out a delay.
 *
 * This derives the missing sub-state from the lead rows the scheduler itself
 * reads, so the UI, the API and the logs all describe the campaign the same
 * way instead of each guessing.
 */

export type CampaignActivityState =
    | 'RUNNING'   // has leads due now — work is happening or about to
    | 'WAITING'   // all remaining leads are parked until a future time
    | 'IDLE';     // nothing left to do (every lead terminal/complete)

export interface CampaignActivity {
    state: CampaignActivityState;
    /** ISO time the earliest parked lead resumes. Null unless WAITING. */
    waitingUntil: string | null;
    /** Leads parked for later. */
    waitingLeads: number;
    /** Leads due now. */
    readyLeads: number;
    /** Short human sentence for UI/logs — always safe to render verbatim. */
    label: string;
}

/** Mirrors the scheduler's terminal set so both agree on what's still live. */
const TERMINAL_PROGRESS = ['COMPLETED', 'STALLED', 'FAILED', 'REPLIED'] as const;

function humanizeUntil(until: Date, now: Date): string {
    const ms = until.getTime() - now.getTime();
    if (ms <= 0) return 'shortly';
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `in ${mins} min`;
    const hours = Math.round(ms / 3_600_000);
    if (hours < 48) return `in ${hours}h`;
    return `in ${Math.round(ms / 86_400_000)}d`;
}

/**
 * Activity for many campaigns in two queries flat, regardless of how many
 * campaigns are passed — this is called from the dashboard list.
 */
export async function getCampaignActivity(
    campaignIds: string[],
): Promise<Record<string, CampaignActivity>> {
    const out: Record<string, CampaignActivity> = {};
    if (!campaignIds.length) return out;

    const now = new Date();

    const [leads, terminal] = await Promise.all([
        prisma.campaignLead.findMany({
            where: { campaignId: { in: campaignIds }, isCompleted: false },
            select: { campaignId: true, leadId: true, nextActionDate: true },
        }),
        prisma.campaignLeadProgress.findMany({
            where: { campaignId: { in: campaignIds }, status: { in: [...TERMINAL_PROGRESS] } },
            select: { campaignId: true, leadId: true },
        }),
    ]);

    const terminalKeys = new Set(terminal.map((t) => `${t.campaignId}:${t.leadId}`));

    for (const id of campaignIds) {
        out[id] = { state: 'IDLE', waitingUntil: null, waitingLeads: 0, readyLeads: 0, label: 'Nothing left to do' };
    }

    for (const lead of leads) {
        if (terminalKeys.has(`${lead.campaignId}:${lead.leadId}`)) continue;
        const acc = out[lead.campaignId];
        if (!acc) continue;

        // A null nextActionDate means "run as soon as possible" — the same way
        // the scheduler's `lte: now` filter treats a matured row.
        const due = lead.nextActionDate == null || lead.nextActionDate <= now;
        if (due) {
            acc.readyLeads += 1;
        } else {
            acc.waitingLeads += 1;
            const iso = lead.nextActionDate!.toISOString();
            if (!acc.waitingUntil || iso < acc.waitingUntil) acc.waitingUntil = iso;
        }
    }

    for (const id of campaignIds) {
        const acc = out[id];
        if (acc.readyLeads > 0) {
            acc.state = 'RUNNING';
            acc.waitingUntil = null;
            acc.label = `Working through ${acc.readyLeads} lead${acc.readyLeads === 1 ? '' : 's'}`;
        } else if (acc.waitingLeads > 0 && acc.waitingUntil) {
            acc.state = 'WAITING';
            acc.label = `Waiting — ${acc.waitingLeads} lead${acc.waitingLeads === 1 ? '' : 's'} resume ${humanizeUntil(new Date(acc.waitingUntil), now)}`;
        }
    }

    return out;
}

/** Single-campaign convenience wrapper. */
export async function getOneCampaignActivity(campaignId: string): Promise<CampaignActivity> {
    const map = await getCampaignActivity([campaignId]);
    return map[campaignId];
}
