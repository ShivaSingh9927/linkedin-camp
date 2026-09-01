// query-tools.ts — the copilot's READ-ONLY, on-demand lookups.
//
// Deterministic "Option B": the router classifies an intent, then the backend
// runs the matching query BEFORE composing the reply — no second LLM round-trip,
// no embeddings. Each tool is a precise DB read that returns a SMALL SUMMARY
// (counts / top-N buckets), never raw rows, so token + query cost stay flat no
// matter how large the account grows.
//
// INVARIANT: every function here is strictly read-only — find*/count/groupBy
// ONLY. Nothing in this file may ever create, update, or delete. All writes stay
// on the confirmed-intent path (launch_campaign → confirm, find_leads → consumes
// search budget), where the user explicitly approves the side effect. A read tool
// that could mutate would blow a hole in that guardrail.

import { prisma } from '@repo/db';
import type { CopilotIntent } from './capabilities';
import { flattenDagToFlow, type WorkflowGraph } from '../campaign-engine/workflow-graph';

export interface CampaignStatusData {
    name: string;
    total: number;
    processed: number;
    pct: number;
    connected: number;
    replied: number;
}

// Node-graph-aware view of a campaign. Unlike CampaignStatusData (which reads only
// the coarse CampaignLead.status and calls a lead "processed" only once it flips
// out of PENDING), this reads the EXECUTION model the engine actually drives:
// CampaignLeadProgress (per-lead node position, run status, stall reason,
// connection outcome, next retry) + the workflow graph (the ordered steps) +
// ActionLog (what actually ran). This is what lets the copilot say "20 visited,
// 20 invited, 6 paused on the daily cap" instead of a misleading "0% done".
export interface CampaignProgressData {
    name: string;
    campaignStatus: string;          // Campaign.status (ACTIVE / COMPLETED / PAUSED / ...)
    total: number;                   // CampaignLead rows
    steps: string[];                 // ordered, human-readable workflow steps
    actions: {                       // what actually executed (ActionLog, SUCCESS only)
        visited: number; invited: number; messaged: number;
        liked: number; commented: number; emailed: number; followed: number;
    };
    run: {                           // CampaignLeadProgress.status distribution
        pending: number; inProgress: number; deferred: number;
        replied: number; completed: number; stalled: number; failed: number;
    };
    connected: number;               // genuine 1st-degree (connectionDegree === 1) — real acceptances, NOT Open-Profile messability
    inviteAwaiting: number;          // connectionStatus === 'pending' (invite out, not yet accepted)
    // statusReason distributions split by whether the lead can still move.
    // pausedReasons: DEFERRED leads — will resume automatically. stoppedReasons:
    // STALLED/FAILED — terminal, need the user to act. endedReasons: COMPLETED —
    // finished naturally (e.g. invite never accepted). Keeping them apart is what
    // lets the copilot say "will resume" vs "won't resume on its own" truthfully.
    pausedReasons: Record<string, number>;
    stoppedReasons: Record<string, number>;
    endedReasons: Record<string, number>;
    activeLeads: number;             // non-terminal (pending + inProgress + deferred)
    effectivelyDone: boolean;        // every lead has reached a terminal run status
    nextActionAt: string | null;     // earliest scheduled resume (ISO) among deferred leads
}

export interface RepliesWaitingData {
    count: number;
    names: string[];
}

export interface AudienceSummaryData {
    total: number;
    topTitles: { value: string; count: number }[];
    topCompanies: { value: string; count: number }[];
    byStatus: Record<string, number>;
    byDegree: Record<string, number>;
}

export interface LeadMatch {
    name: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    linkedinUrl?: string;
    status: string;
}

export interface LeadInfoData {
    name: string;
    headline?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    status: string;
    connectionDegree?: number | null;
    tags: string[];
    latestPost?: string;
    recentMessages: { direction: string; snippet: string; at: string }[];
    recentActions: { actionType: string; status: string; at: string }[];
}

// What the intent dispatcher hands back to the caller. All fields optional — a
// given intent only fills the slice it needs, and any tool that throws is
// swallowed (fail-open) so a lookup hiccup never blocks the reply.
export interface SearchDraft {
    label: string;
    keywords: string;
    filters: { title?: string; location?: string; industry?: string; degree?: string };
    rationale: string;
    // The model's chain-of-thought for this query (build-search only; "" otherwise).
    reasoning?: string;
}

export interface WaitingReplyItem {
    leadId: string;
    name: string;
    subtitle: string;   // "jobTitle · 2nd"
    message: string;    // their last inbound message (clipped)
    at: string;         // ISO of their reply
}

export interface QueryToolData {
    campaign?: CampaignStatusData | null;
    campaignProgress?: CampaignProgressData | null;
    lastCompleted?: CampaignStatusData | null;
    repliesWaiting?: RepliesWaitingData;
    available?: { count: number };
    audience?: AudienceSummaryData;
    leads?: LeadMatch[];
    searchDraft?: SearchDraft;
    waitingReplies?: WaitingReplyItem[];
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const fullName = (f?: string | null, l?: string | null) => [f, l].filter(Boolean).join(' ').trim() || 'a lead';

// ── individual read tools ────────────────────────────────────────────────────

export async function getCampaignStatus(userId: string): Promise<CampaignStatusData | null> {
    const active = await prisma.campaign.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
    });
    if (!active) return null;

    const groups = await prisma.campaignLead.groupBy({
        by: ['status'],
        where: { campaignId: active.id },
        _count: { _all: true },
    });
    const by: Record<string, number> = {};
    for (const g of groups) by[g.status] = g._count._all;
    const total = Object.values(by).reduce((s, n) => s + n, 0);
    const pending = by['PENDING'] || 0;
    const connected = (by['CONNECTED'] || 0) + (by['REPLIED'] || 0);
    const replied = by['REPLIED'] || 0;
    const processed = Math.max(0, total - pending);
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    return { name: active.name, total, processed, pct, connected, replied };
}

// Most recently created COMPLETED campaign + its outcome — for a retrospective
// ("your last campaign finished: N connected, R replied"). Campaign has no
// updatedAt, so "most recent" is by createdAt (good enough for the newest one).
export async function getLastCompletedCampaign(userId: string): Promise<CampaignStatusData | null> {
    const done = await prisma.campaign.findFirst({
        where: { userId, status: 'COMPLETED' },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
    });
    if (!done) return null;
    const groups = await prisma.campaignLead.groupBy({
        by: ['status'],
        where: { campaignId: done.id },
        _count: { _all: true },
    });
    const by: Record<string, number> = {};
    for (const g of groups) by[g.status] = g._count._all;
    const total = Object.values(by).reduce((s, n) => s + n, 0);
    const connected = (by['CONNECTED'] || 0) + (by['REPLIED'] || 0);
    const replied = by['REPLIED'] || 0;
    return { name: done.name, total, processed: total, pct: 100, connected, replied };
}

// Engine node name (lowercase, as written to ActionLog / emitted by
// flattenDagToFlow) → a human step label for the workflow summary. Kept here (not
// imported) so the copilot's phrasing can differ from the engine's internal names.
const ENGINE_NODE_LABEL: Record<string, string> = {
    'profile-visit': 'Visit profile',
    'profile-visit-voyager': 'Visit profile',
    'connect': 'Send connection request',
    'send-message': 'Send message',
    'like-nth-post': 'Like a post',
    'comment-nth-post': 'Comment on a post',
    'email': 'Send email',
    'email-finder': 'Find email',
    'follow': 'Follow',
    'check-connection': 'Check if connected',
    'check-connection-voyager': 'Check if connected',
    'inbox-sync': 'Sync inbox',
    'inbox-sync-voyager': 'Sync inbox',
    'delay': 'Wait',
    'if-else': 'Branch on connection',
};

// Turn one flattened flow node into a human label. Delays get their duration
// inlined ("Wait 1 day") when the node carries it; if-else appends its branches.
function labelFlowNode(n: any): string {
    const node = String(n?.node || '');
    if (node === 'delay') {
        const d = n || {};
        const days = Number(d.delayDays ?? d.days ?? (d.data && (d.data.delayDays ?? d.data.days)) ?? 0);
        const hours = Number(d.delayHours ?? d.hours ?? (d.data && (d.data.delayHours ?? d.data.hours)) ?? 0);
        if (days > 0) return `Wait ${days} day${days === 1 ? '' : 's'}`;
        if (hours > 0) return `Wait ${hours} hour${hours === 1 ? '' : 's'}`;
        return 'Wait';
    }
    if (node === 'if-else') {
        const branch = (arr: any[]): string => (arr || []).map(labelFlowNode).filter(Boolean).join(' → ');
        const t = branch(n.trueBranch);
        return t ? `If connected: ${t}` : 'Branch on connection';
    }
    return ENGINE_NODE_LABEL[node] || '';
}

// Ordered, human-readable step list for a campaign's workflow. Reuses the engine's
// own flattener so the copilot describes the SAME graph the engine executes (not a
// second, drifting interpretation). Capped so a long sequence stays a glance.
function summarizeWorkflowSteps(workflow: unknown): string[] {
    try {
        const wf = workflow as WorkflowGraph;
        if (!wf?.nodes?.length) return [];
        const flow = flattenDagToFlow(wf);
        const labels = flow.map(labelFlowNode).filter(Boolean);
        return labels.slice(0, 12);
    } catch {
        return [];
    }
}

// The node-graph-aware campaign read. Prefers the ACTIVE campaign; falls back to
// the most recently created one (so "what happened to my campaign?" still answers
// after it finishes). Everything comes from the execution model, so the answer is
// correct even when the coarse Campaign.status / CampaignLead.status are stale
// (e.g. all leads terminal but the campaign not yet flipped to COMPLETED).
export async function getCampaignProgress(userId: string): Promise<CampaignProgressData | null> {
    const campaign =
        (await prisma.campaign.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true, workflow: true, workflowJson: true } }))
        || (await prisma.campaign.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true, workflow: true, workflowJson: true } }));
    if (!campaign) return null;

    const [total, progressRows, actionRows] = await Promise.all([
        prisma.campaignLead.count({ where: { campaignId: campaign.id } }),
        prisma.campaignLeadProgress.findMany({
            where: { campaignId: campaign.id },
            select: { leadId: true, status: true, statusReason: true, connectionStatus: true, needsRetry: true, nextRetryAt: true },
        }),
        prisma.actionLog.groupBy({
            by: ['actionType'],
            where: { campaignId: campaign.id, status: 'SUCCESS' },
            _count: { _all: true },
        }),
    ]);

    const act: Record<string, number> = {};
    for (const a of actionRows) act[a.actionType] = a._count._all;
    const actions = {
        visited: (act['profile-visit'] || 0) + (act['profile-visit-voyager'] || 0),
        invited: act['connect'] || 0,
        messaged: act['send-message'] || 0,
        liked: act['like-nth-post'] || 0,
        commented: act['comment-nth-post'] || 0,
        emailed: act['email'] || 0,
        followed: act['follow'] || 0,
    };

    const run = { pending: 0, inProgress: 0, deferred: 0, replied: 0, completed: 0, stalled: 0, failed: 0 };
    const pausedReasons: Record<string, number> = {};
    const stoppedReasons: Record<string, number> = {};
    const endedReasons: Record<string, number> = {};
    const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] || 0) + 1; };
    let connected = 0;
    let inviteAwaiting = 0;
    let nextRetry: number | null = null;
    for (const p of progressRows) {
        switch (p.status) {
            case 'PENDING': run.pending++; break;
            case 'IN_PROGRESS': run.inProgress++; break;
            case 'DEFERRED': run.deferred++; break;
            case 'REPLIED': run.replied++; break;
            case 'COMPLETED': run.completed++; break;
            case 'STALLED': run.stalled++; break;
            case 'FAILED': run.failed++; break;
        }
        if (p.statusReason) {
            if (p.status === 'DEFERRED') bump(pausedReasons, p.statusReason);
            else if (p.status === 'STALLED' || p.status === 'FAILED') bump(stoppedReasons, p.statusReason);
            else if (p.status === 'COMPLETED') bump(endedReasons, p.statusReason);
        }
        // inviteAwaiting = invite out, not yet accepted (messability signal is fine
        // here). `connected` (real acceptances) is counted separately below off
        // connectionDegree===1, since connectionStatus='connected' also covers
        // Open-Profile (messageable, not connected) and would overstate it.
        if (p.connectionStatus === 'pending') inviteAwaiting++;
        if (p.status === 'DEFERRED' && p.nextRetryAt) {
            const t = new Date(p.nextRetryAt).getTime();
            nextRetry = nextRetry == null ? t : Math.min(nextRetry, t);
        }
    }
    const activeLeads = run.pending + run.inProgress + run.deferred;

    // Real acceptances = genuine 1st-degree connections (connectionDegree===1),
    // NOT connectionStatus='connected' (which also counts Open-Profile leads that
    // are merely messageable). Counted off the Lead rows so the figure matches
    // the coarse CONNECTED status the dashboard/campaign page show.
    if (progressRows.length > 0) {
        const degreeRows = await prisma.lead.findMany({
            where: { id: { in: progressRows.map((p) => p.leadId) } },
            select: { connectionDegree: true },
        }).catch(() => [] as { connectionDegree: number | null }[]);
        connected = degreeRows.filter((l) => l.connectionDegree === 1).length;
    }

    return {
        name: campaign.name,
        campaignStatus: campaign.status,
        total,
        steps: summarizeWorkflowSteps(campaign.workflowJson ?? campaign.workflow),
        actions,
        run,
        connected,
        inviteAwaiting,
        pausedReasons,
        stoppedReasons,
        endedReasons,
        activeLeads,
        effectivelyDone: progressRows.length > 0 && activeLeads === 0,
        nextActionAt: nextRetry != null ? new Date(nextRetry).toISOString() : null,
    };
}

// Uncampaigned leads. Scalar-only set-diff (userId + leadId) — no relation
// accessor — because the Lead↔CampaignLead relation name drifts (see
// project_prisma_casing_drift). Mirrors lead.controller.getAvailableLeads.
export async function getAvailableLeadsCount(userId: string): Promise<{ count: number }> {
    const leads = await prisma.lead.findMany({ where: { userId }, select: { id: true } });
    const ids = leads.map((l) => l.id);
    if (!ids.length) return { count: 0 };
    const taken = await prisma.campaignLead.findMany({
        where: { leadId: { in: ids } },
        select: { leadId: true },
    });
    const takenSet = new Set(taken.map((t) => t.leadId));
    return { count: ids.filter((id) => !takenSet.has(id)).length };
}

// Conversations awaiting the user's reply: a lead whose latest message is inbound
// (they replied and we haven't answered since). Same inbound/outbound signal the
// Follow-ups list uses, minus the age threshold — in chat, "who's waiting on me"
// means all unanswered replies. Bounded by the user's message volume.
export async function getRepliesWaiting(userId: string): Promise<RepliesWaitingData> {
    const messages = await prisma.message.findMany({
        where: { userId },
        select: { leadId: true, direction: true, sentAt: true },
        orderBy: { sentAt: 'asc' },
    });
    type Sig = { lastInbound: number | null; lastOutbound: number | null };
    const sig: Record<string, Sig> = {};
    for (const m of messages) {
        const s = (sig[m.leadId] ||= { lastInbound: null, lastOutbound: null });
        const t = new Date(m.sentAt).getTime();
        if (m.direction === 'RECEIVED') s.lastInbound = Math.max(s.lastInbound ?? 0, t);
        else s.lastOutbound = Math.max(s.lastOutbound ?? 0, t);
    }
    const waitingIds = Object.entries(sig)
        .filter(([, s]) => s.lastInbound != null && (s.lastOutbound == null || s.lastInbound > s.lastOutbound))
        .map(([id]) => id);
    if (!waitingIds.length) return { count: 0, names: [] };
    const leads = await prisma.lead.findMany({
        where: { id: { in: waitingIds.slice(0, 3) }, userId },
        select: { firstName: true, lastName: true },
    });
    return { count: waitingIds.length, names: leads.map((l) => fullName(l.firstName, l.lastName)) };
}

// Who the user has actually imported — top job titles + companies + status /
// degree breakdowns, all via groupBy so the DB does the aggregation and the
// output is a fixed small top-N regardless of account size. Lets recommendations
// reflect the real audience, not just the stated profile. (Lead has no industry
// column, so we key on titles/companies.)
export async function getAudienceSummary(userId: string): Promise<AudienceSummaryData> {
    const [total, titles, companies, statuses, degrees] = await Promise.all([
        prisma.lead.count({ where: { userId } }),
        prisma.lead.groupBy({
            by: ['jobTitle'], where: { userId, jobTitle: { not: null } },
            _count: { jobTitle: true }, orderBy: { _count: { jobTitle: 'desc' } }, take: 5,
        }),
        prisma.lead.groupBy({
            by: ['company'], where: { userId, company: { not: null } },
            _count: { company: true }, orderBy: { _count: { company: 'desc' } }, take: 5,
        }),
        prisma.lead.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
        prisma.lead.groupBy({ by: ['connectionDegree'], where: { userId }, _count: { _all: true } }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const s of statuses) byStatus[s.status] = s._count._all;
    const byDegree: Record<string, number> = {};
    for (const d of degrees) byDegree[d.connectionDegree == null ? 'unknown' : String(d.connectionDegree)] = d._count._all;
    return {
        total,
        topTitles: titles.map((t) => ({ value: t.jobTitle as string, count: t._count.jobTitle })),
        topCompanies: companies.map((c) => ({ value: c.company as string, count: c._count.company })),
        byStatus,
        byDegree,
    };
}

// Look up leads ALREADY in the user's list by name (read-only). Case-insensitive
// match on first/last name across the query's word tokens. Returns the top few
// so the copilot can answer "what's X's company / URL / status?" from the user's
// own data — never a LinkedIn search.
export async function findLeadByName(userId: string, query: string): Promise<LeadMatch[]> {
    const q = (query || '').trim();
    if (!q) return [];
    const SELECT = { firstName: true, lastName: true, jobTitle: true, company: true, location: true, linkedinUrl: true, status: true } as const;
    const toMatch = (l: { firstName: string | null; lastName: string | null; jobTitle: string | null; company: string | null; location: string | null; linkedinUrl: string | null; status: string }): LeadMatch => ({
        name: fullName(l.firstName, l.lastName),
        jobTitle: l.jobTitle || undefined,
        company: l.company || undefined,
        location: l.location || undefined,
        linkedinUrl: l.linkedinUrl || undefined,
        status: l.status,
    });

    // Primary: token substring match on first/last name (fast, handles "sneh",
    // "singh", "sneh singh").
    const tokens = q.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2).slice(0, 4);
    const terms = tokens.length ? tokens : [q];
    const OR = terms.flatMap((t) => [
        { firstName: { contains: t, mode: 'insensitive' as const } },
        { lastName: { contains: t, mode: 'insensitive' as const } },
    ]);
    const primary = await prisma.lead.findMany({ where: { userId, OR }, select: SELECT, take: 5 });
    if (primary.length) return primary.map(toMatch);

    // Fuzzy fallback: the query joined the name or misspelled the spacing
    // ("snehsingh" → "sneh singh"). Normalize both sides (drop non-alphanumerics)
    // and match the concatenated full name. Bounded scan; only runs on a miss.
    const norm = (s?: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nq = norm(q);
    if (nq.length < 3) return [];
    const candidates = await prisma.lead.findMany({ where: { userId }, select: SELECT, take: 500 });
    return candidates
        .filter((l) => {
            const full = norm(`${l.firstName || ''}${l.lastName || ''}`);
            return full.length >= 3 && (full.includes(nq) || nq.includes(full));
        })
        .slice(0, 5)
        .map(toMatch);
}

// Leads whose LATEST message is inbound (they replied, we haven't answered) —
// with the lead + their last message, so the copilot can draft in-chat. Same
// unanswered-inbound signal as getRepliesWaiting, but returns the content needed
// to render a reply card. Newest reply first; bounded.
export async function getWaitingReplies(userId: string, limit = 10): Promise<WaitingReplyItem[]> {
    const messages = await prisma.message.findMany({
        where: { userId },
        select: { leadId: true, direction: true, content: true, sentAt: true },
        orderBy: { sentAt: 'asc' },
    });
    type Sig = { lastInbound: number | null; lastOutbound: number | null; content: string; at: string };
    const sig: Record<string, Sig> = {};
    for (const m of messages) {
        const s = (sig[m.leadId] ||= { lastInbound: null, lastOutbound: null, content: '', at: '' });
        const t = new Date(m.sentAt).getTime();
        if (m.direction === 'RECEIVED') {
            if (s.lastInbound == null || t >= s.lastInbound) { s.lastInbound = t; s.content = m.content || ''; s.at = new Date(m.sentAt).toISOString(); }
        } else {
            s.lastOutbound = Math.max(s.lastOutbound ?? 0, t);
        }
    }
    const ids = Object.entries(sig)
        .filter(([, s]) => s.lastInbound != null && (s.lastOutbound == null || s.lastInbound > s.lastOutbound))
        .sort((a, b) => (b[1].lastInbound ?? 0) - (a[1].lastInbound ?? 0))
        .map(([id]) => id)
        .slice(0, limit);
    if (!ids.length) return [];
    const leads = await prisma.lead.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, firstName: true, lastName: true, jobTitle: true, connectionDegree: true },
    });
    const byId: Record<string, (typeof leads)[number]> = {};
    leads.forEach((l) => { byId[l.id] = l; });
    return ids
        .map((id): WaitingReplyItem | null => {
            const l = byId[id];
            if (!l) return null;
            const deg = l.connectionDegree === 1 ? '1st' : l.connectionDegree === 2 ? '2nd' : l.connectionDegree === 3 ? '3rd' : '';
            const subtitle = [l.jobTitle || '', deg].filter(Boolean).join(' · ');
            return { leadId: id, name: fullName(l.firstName, l.lastName), subtitle, message: clip(sig[id].content, 240), at: sig[id].at };
        })
        .filter((x): x is WaitingReplyItem => x !== null);
}

// One lead in depth — for per-lead reasoning (e.g. drafting a reply in the
// inbox). Fired with an explicit leadId, not from free-text chat (which has no
// leadId to key on) — this is the seam the inbox flow will call.
export async function getLeadInfo(userId: string, leadId: string): Promise<LeadInfoData | null> {
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId },
        select: {
            firstName: true, lastName: true, headline: true, jobTitle: true, company: true,
            location: true, status: true, connectionDegree: true, tags: true, latestPost: true,
        },
    });
    if (!lead) return null;
    const [messages, actions] = await Promise.all([
        prisma.message.findMany({
            where: { userId, leadId }, orderBy: { sentAt: 'desc' }, take: 5,
            select: { direction: true, content: true, sentAt: true },
        }),
        prisma.actionLog.findMany({
            where: { userId, leadId }, orderBy: { executedAt: 'desc' }, take: 5,
            select: { actionType: true, status: true, executedAt: true },
        }),
    ]);
    return {
        name: fullName(lead.firstName, lead.lastName),
        headline: lead.headline || undefined,
        jobTitle: lead.jobTitle || undefined,
        company: lead.company || undefined,
        location: lead.location || undefined,
        status: lead.status,
        connectionDegree: lead.connectionDegree,
        tags: lead.tags || [],
        latestPost: lead.latestPost ? clip(lead.latestPost, 160) : undefined,
        recentMessages: messages.map((m) => ({ direction: m.direction, snippet: clip(m.content), at: m.sentAt.toISOString() })),
        recentActions: actions.map((a) => ({ actionType: a.actionType, status: a.status, at: a.executedAt.toISOString() })),
    };
}

// statusReason (free-form engine strings) → a bare plain-English phrase. The
// formatter adds the paused/stopped/ended framing, so these stay unframed. Falls
// back to a tidied version of the raw reason for anything unseen.
const REASON_LABELS: Record<string, string> = {
    daily_cap: 'daily invite limit reached',
    off_hours: 'outside sending hours',
    delay_node: 'waiting out a scheduled delay',
    lead_replied: 'replied 🎉',
    connection_not_accepted: 'invite not accepted in time — sequence ended',
    connection_not_confirmed: 'invite not accepted in time — sequence ended',
    acceptance_seed_failed: 'couldn’t verify acceptance — sequence ended',
    sequence_finished: 'finished the full sequence',
    account_session_expired: 'your LinkedIn session needs reconnecting',
    account_otp_required: 'LinkedIn asked for a verification code',
};
function reasonLabel(raw: string): string {
    if (REASON_LABELS[raw]) return REASON_LABELS[raw];
    if (raw.startsWith('account_')) return 'your LinkedIn account needs attention';
    return raw.replace(/_/g, ' ');
}

function relativeWhen(iso: string, now: number): string {
    const diff = new Date(iso).getTime() - now;
    if (diff <= 0) return 'shortly';
    const h = Math.round(diff / 3_600_000);
    if (h < 1) return 'within the hour';
    if (h < 24) return `in ~${h}h`;
    const d = Math.round(h / 24);
    return `in ~${d} day${d === 1 ? '' : 's'}`;
}

// Compose the truthful, node-graph-aware status lines. This is the authoritative
// text the copilot shows for "what's happening with my campaign?" — grounded in
// the execution model, so it reports real work done (visits/invites/messages),
// where leads actually ended up (connected / awaiting / stalled + WHY), and what
// happens next — never the misleading "0% done" the coarse status produced.
export function describeCampaignProgress(p: CampaignProgressData, now: number): string {
    const lines: string[] = [];
    const doneNote = p.effectivelyDone && p.campaignStatus === 'ACTIVE'
        ? ' (every lead has finished its sequence — this campaign is effectively complete)'
        : '';
    lines.push(`**“${p.name}”** — ${p.campaignStatus.toLowerCase()}, ${p.total} lead${p.total === 1 ? '' : 's'}${doneNote}.`);

    if (p.steps.length) lines.push(`Sequence: ${p.steps.join(' → ')}.`);

    // What actually ran (only surface the steps that fired).
    const did: string[] = [];
    if (p.actions.visited) did.push(`${p.actions.visited} profile${p.actions.visited === 1 ? '' : 's'} visited`);
    if (p.actions.invited) did.push(`${p.actions.invited} connection request${p.actions.invited === 1 ? '' : 's'} sent`);
    if (p.actions.messaged) did.push(`${p.actions.messaged} message${p.actions.messaged === 1 ? '' : 's'} sent`);
    if (p.actions.liked) did.push(`${p.actions.liked} post${p.actions.liked === 1 ? '' : 's'} liked`);
    if (p.actions.commented) did.push(`${p.actions.commented} comment${p.actions.commented === 1 ? '' : 's'}`);
    if (p.actions.emailed) did.push(`${p.actions.emailed} email${p.actions.emailed === 1 ? '' : 's'} sent`);
    if (p.actions.followed) did.push(`${p.actions.followed} followed`);
    lines.push(did.length ? `Done so far: ${did.join(', ')}.` : 'No steps have run yet.');

    // Outcomes: connections + replies first (the wins), then where the rest sit.
    const outcomes: string[] = [];
    if (p.connected) outcomes.push(`**${p.connected} connected**`);
    if (p.run.replied) outcomes.push(`**${p.run.replied} replied**`);
    if (p.inviteAwaiting) outcomes.push(`${p.inviteAwaiting} invite${p.inviteAwaiting === 1 ? '' : 's'} awaiting acceptance`);
    if (outcomes.length) lines.push(`Outcomes: ${outcomes.join(', ')}.`);

    // WHY leads stopped — split by whether they can still move, biggest first. This
    // is the piece the old status was blind to. Paused = will resume; stopped =
    // terminal, needs the user; ended = finished naturally (e.g. invite not taken).
    const top = (m: Record<string, number>) => Object.entries(m)
        .filter(([r]) => r !== 'sequence_finished' && r !== 'lead_replied')
        .sort((a, b) => b[1] - a[1]);
    for (const [raw, n] of top(p.pausedReasons).slice(0, 3)) {
        lines.push(`• ${n} lead${n === 1 ? '' : 's'} paused — ${reasonLabel(raw)}; will resume automatically.`);
    }
    for (const [raw, n] of top(p.stoppedReasons).slice(0, 3)) {
        const extra = raw === 'daily_cap' ? ' — hit the daily invite cap too many times; won’t resume on their own (relaunch to retry them)' : ` — ${reasonLabel(raw)}; won’t resume on their own`;
        lines.push(`• ${n} lead${n === 1 ? '' : 's'} stopped${extra}.`);
    }
    for (const [raw, n] of top(p.endedReasons).slice(0, 2)) {
        lines.push(`• ${n} lead${n === 1 ? '' : 's'}: ${reasonLabel(raw)}.`);
    }

    // What happens next.
    if (p.nextActionAt) {
        lines.push(`Next action ${relativeWhen(p.nextActionAt, now)} (paused leads resume automatically).`);
    }
    return lines.join('\n');
}

// ── intent → query dispatcher (deterministic pre-fetch) ──────────────────────

// Given the routed intent, run the read tool(s) that intent needs. Each tool is
// wrapped so a failure yields a partial/empty result rather than throwing — the
// reply must always send. Returns null when the intent needs no live lookup.
export async function runIntentQuery(intent: CopilotIntent, userId: string): Promise<QueryToolData | null> {
    const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);
    switch (intent) {
        case 'check_status': {
            // Node-graph-aware progress is the authoritative source (reads the
            // execution model, so it's right even when Campaign.status is stale).
            // Keep the coarse getCampaignStatus/lastCompleted as a fallback for
            // when there's no progress data yet (brand-new campaign).
            const [campaignProgress, campaign] = await Promise.all([
                safe(getCampaignProgress(userId), null),
                safe(getCampaignStatus(userId), null),
            ]);
            return {
                campaignProgress,
                campaign,
                // Only bother with the retrospective when nothing's running now.
                lastCompleted: campaign ? null : await safe(getLastCompletedCampaign(userId), null),
                repliesWaiting: await safe(getRepliesWaiting(userId), { count: 0, names: [] }),
            };
        }
        case 'launch_campaign':
            return { available: await safe(getAvailableLeadsCount(userId), { count: 0 }) };
        case 'recommend_campaign':
        case 'find_leads':
            return { audience: await safe(getAudienceSummary(userId), undefined as unknown as AudienceSummaryData) };
        default:
            return null;
    }
}
