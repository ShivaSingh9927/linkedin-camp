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

export interface CampaignStatusData {
    name: string;
    total: number;
    processed: number;
    pct: number;
    connected: number;
    replied: number;
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
export interface QueryToolData {
    campaign?: CampaignStatusData | null;
    repliesWaiting?: RepliesWaitingData;
    available?: { count: number };
    audience?: AudienceSummaryData;
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

// ── intent → query dispatcher (deterministic pre-fetch) ──────────────────────

// Given the routed intent, run the read tool(s) that intent needs. Each tool is
// wrapped so a failure yields a partial/empty result rather than throwing — the
// reply must always send. Returns null when the intent needs no live lookup.
export async function runIntentQuery(intent: CopilotIntent, userId: string): Promise<QueryToolData | null> {
    const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);
    switch (intent) {
        case 'check_status':
            return {
                campaign: await safe(getCampaignStatus(userId), null),
                repliesWaiting: await safe(getRepliesWaiting(userId), { count: 0, names: [] }),
            };
        case 'launch_campaign':
            return { available: await safe(getAvailableLeadsCount(userId), { count: 0 }) };
        case 'recommend_campaign':
        case 'find_leads':
            return { audience: await safe(getAudienceSummary(userId), undefined as unknown as AudienceSummaryData) };
        default:
            return null;
    }
}
