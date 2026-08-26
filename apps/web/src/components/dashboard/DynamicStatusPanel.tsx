'use client';

// The dashboard's dynamic status panel. State-aware: it always answers "what's
// happening, and what should I do next?" — a live campaign with a real activity
// stream when one is running, and a prioritized nudge (replies waiting → idle →
// just-finished → finish setup) otherwise. Everything here is REAL data:
// activity rows come from the audit log (actionLog), never fabricated.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    UserPlus, Send, Eye, MessageSquare, Rocket, Sparkles, Play, Activity, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { SetupStatus } from '@/components/ActivationHero';

export interface StatusCampaign {
    id: string;
    name: string;
    status: string;
    totalLeads: number;
    pending: number;
    connected: number;
    replied: number;
}

export interface StatusLog {
    id: string;
    actionType: string;
    status: string;
    executedAt: string;
    campaignId?: string | null;
    Lead?: { firstName?: string | null; lastName?: string | null } | null;
    lead?: { firstName?: string | null; lastName?: string | null } | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Only user-facing actions belong in the activity feed — internal bookkeeping
// (CRM syncs, reply polling) would just be noise. Keys are the raw actionType
// STRINGS the engine writes (it's a free-text column, not an enum): INVITE,
// MESSAGE, VISIT.
const ACTION_META: Record<string, { icon: typeof Send; verb: (name: string) => string }> = {
    INVITE: { icon: UserPlus, verb: (n) => `Sent invite to ${n}` },
    MESSAGE: { icon: Send, verb: (n) => `Messaged ${n}` },
    VISIT: { icon: Eye, verb: (n) => `Visited ${n}${n === 'a lead' ? '' : "'s"} profile` },
};

function leadName(log: StatusLog): string {
    const l = log.Lead || log.lead;
    const name = [l?.firstName, l?.lastName].filter(Boolean).join(' ').trim();
    return name || 'a lead';
}

function relTime(iso: string | undefined, now: number): string {
    if (!iso) return '';
    const diff = now - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
}

interface Nudge {
    icon: typeof Rocket;
    text: React.ReactNode;
    cta?: string;
    href?: string;
    tone: 'brand' | 'success';
}

export function DynamicStatusPanel({ campaigns, logs, setup, loading, quotas }: {
    campaigns: StatusCampaign[];
    logs: StatusLog[];
    setup: SetupStatus | null;
    loading: boolean;
    quotas?: { label: string; value: number; total: number }[];
}) {
    const [repliesWaiting, setRepliesWaiting] = useState(0);
    // Capture "now" once (lazy init) — reading Date.now() directly in the render
    // body is flagged as impure. Relative times are approximate, so a per-mount
    // snapshot is exactly right.
    const [now] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        // Replies genuinely awaiting a human response (same source as the
        // Follow-ups nav badge). A failure just hides the nudge — never blocks.
        api.get('/leads/follow-ups')
            .then(({ data }) => { if (!cancelled) setRepliesWaiting(data?.counts?.replied || 0); })
            .catch(() => { /* nudge just won't show */ });
        return () => { cancelled = true; };
    }, []);

    const active = campaigns.find((c) => c.status === 'ACTIVE');
    const feed = logs.filter((l) => ACTION_META[l.actionType] && l.status === 'SUCCESS').slice(0, 6);
    const lastActivityAt = logs[0]?.executedAt;
    const idleDays = lastActivityAt ? Math.floor((now - new Date(lastActivityAt).getTime()) / DAY_MS) : null;

    // Campaign has no updatedAt in the schema, so approximate "finished when?"
    // from the most recent audit-log action attributed to each campaign — real
    // data, no fabricated timestamp. May be absent if the campaign's last action
    // fell outside the recent-log window (then we show the nudge without a time).
    const lastLogByCampaign: Record<string, string> = {};
    for (const l of logs) {
        if (l.campaignId && !lastLogByCampaign[l.campaignId]) lastLogByCampaign[l.campaignId] = l.executedAt;
    }
    const recentlyCompleted = campaigns
        .filter((c) => c.status === 'COMPLETED')
        .map((c) => ({ c, at: lastLogByCampaign[c.id] }))
        .filter((x) => x.at)
        .sort((a, b) => (b.at! > a.at! ? 1 : -1))[0];

    // Single highest-priority nudge: a human action waiting on them beats an
    // idle prompt beats a "just finished" prompt beats an optional-setup prompt.
    const nudge = ((): Nudge | null => {
        if (repliesWaiting > 0) {
            return {
                icon: MessageSquare, tone: 'brand', cta: 'Open inbox', href: '/inbox',
                text: <><b className="font-semibold">{repliesWaiting} {repliesWaiting === 1 ? 'reply' : 'replies'} waiting</b> — keep the conversation going.</>,
            };
        }
        if (!active) {
            if (recentlyCompleted && now - new Date(recentlyCompleted.at!).getTime() < 2 * DAY_MS) {
                const { c, at } = recentlyCompleted;
                return {
                    icon: CheckCircle2, tone: 'success', cta: 'New campaign', href: '/campaigns',
                    text: <><b className="font-semibold">{c.name}</b> finished {relTime(at, now)} ago — {c.connected} connected, {c.replied} replied. Ready for the next batch?</>,
                };
            }
            if (idleDays != null && idleDays >= 3) {
                return {
                    icon: Play, tone: 'brand', cta: 'New campaign', href: '/campaigns',
                    text: <>You haven&rsquo;t run a campaign in <b className="font-semibold">{idleDays} days</b>. Your leads are waiting.</>,
                };
            }
        }
        if (setup && !setup.emailDone) {
            return {
                icon: Sparkles, tone: 'brand', cta: 'Connect', href: '/settings?tab=email',
                text: <>Connect your email to find verified addresses for your leads.</>,
            };
        }
        return null;
    })();

    const processed = active ? Math.max(0, active.totalLeads - active.pending) : 0;
    const pct = active && active.totalLeads > 0 ? Math.round((processed / active.totalLeads) * 100) : 0;

    return (
        <div className="bg-card border border-line rounded-card shadow-soft flex flex-col h-full min-h-0 overflow-hidden">
            {/* Header — live campaign, or resting state */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line shrink-0">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', active ? 'bg-emerald-500 shadow-[0_0_8px] shadow-emerald-400' : 'bg-amber-400')} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                        {active ? active.name : loading ? 'Loading…' : 'No campaign running'}
                    </p>
                    <p className="text-[11px] text-ink-500 leading-tight">
                        {active ? `Autopilot running · ${processed} of ${active.totalLeads} leads` : loading ? '' : 'Ready when you are'}
                    </p>
                </div>
                {active && <span className="text-[12px] font-semibold text-foreground shrink-0">{pct}%</span>}
            </div>

            {/* Progress bar (only while running) */}
            {active && (
                <div className="px-4 pt-3 shrink-0">
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )}

            {/* Priority nudge */}
            {nudge && (
                <div className="px-4 pt-3 shrink-0">
                    <div className={cn('rounded-control px-3 py-2.5 flex items-center gap-2.5', nudge.tone === 'success' ? 'bg-emerald-50' : 'bg-brand-50')}>
                        <nudge.icon className={cn('w-4 h-4 shrink-0', nudge.tone === 'success' ? 'text-emerald-600' : 'text-brand')} />
                        <p className="text-[12px] text-foreground leading-snug flex-1 min-w-0">{nudge.text}</p>
                        {nudge.cta && nudge.href && (
                            <Link href={nudge.href} className={cn('text-[11px] font-medium text-white rounded-chip px-3 py-1.5 shrink-0 transition-colors', nudge.tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand hover:bg-brand-600')}>
                                {nudge.cta}
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Today's limits — the daily budget, in the rail before activity */}
            {quotas && quotas.length > 0 && (
                <div className="px-4 pt-3 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <p className="label !text-[10px]">Today&rsquo;s limits</p>
                        <Link href="/campaigns/queue" className="label !text-[10px] !text-brand hover:underline">Queue →</Link>
                    </div>
                    <div className="space-y-2">
                        {quotas.map((q) => (
                            <div key={q.label}>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[11px] text-ink-500">{q.label}</span>
                                    <span className="num text-[11px] text-ink-500">{q.value}/{q.total}</span>
                                </div>
                                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.min(100, q.total ? (q.value / q.total) * 100 : 0)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Activity stream — real audit-log actions */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                <p className="label !text-[10px] mb-2">Recent activity</p>
                {feed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-6 text-ink-400">
                        <Activity className="w-5 h-5 mb-2" />
                        <p className="text-[12px] text-ink-500">Activity from your campaigns will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {feed.map((log) => {
                            const meta = ACTION_META[log.actionType];
                            const Icon = meta.icon;
                            return (
                                <div key={log.id} className="flex items-center gap-2.5 py-1.5">
                                    <Icon className="w-3.5 h-3.5 text-brand shrink-0" />
                                    <span className="text-[12px] text-ink-700 flex-1 min-w-0 truncate">{meta.verb(leadName(log))}</span>
                                    <span className="text-[10px] text-ink-400 shrink-0">{relTime(log.executedAt, now)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
