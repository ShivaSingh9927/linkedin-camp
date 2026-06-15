"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface Stage {
    key: string;
    label: string;
    count: number;
}

interface FunnelData {
    stages: Stage[];
    dailySeries: { date: string; invites: number; messages: number; replies: number }[];
}

interface Props {
    campaignId: string;
    onStageClick?: (stageKey: string) => void;
}

// Color graduation across the funnel — warm at top (lots of leads),
// cool/saturated at bottom (fewer, more valuable).
const STAGE_COLORS = ['bg-violet-500', 'bg-violet-400', 'bg-blue-400', 'bg-cyan-400', 'bg-teal-400', 'bg-emerald-500'];

export function CampaignFunnel({ campaignId, onStageClick }: Props) {
    const [data, setData] = useState<FunnelData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            try {
                const res = await api.get(`/campaigns/${campaignId}/funnel`);
                if (!cancelled) setData(res.data);
            } catch {
                if (!cancelled) setData(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetch();
        const poll = setInterval(fetch, 30000);
        return () => { cancelled = true; clearInterval(poll); };
    }, [campaignId]);

    if (loading) {
        return (
            <div className="bg-card border border-line rounded-card p-8 flex items-center justify-center h-64 shadow-soft">
                <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
        );
    }
    if (!data) return null;

    const total = data.stages[0]?.count || 1;
    const biggestDrop = findBiggestDrop(data.stages);

    return (
        <div className="bg-card border border-line rounded-card p-6 space-y-5 shadow-soft">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold tracking-tight">The funnel</h3>
                <span className="label">click a stage to filter leads</span>
            </div>
            <div className="space-y-3.5">
                {data.stages.map((stage, i) => {
                    const pct = total ? Math.round((stage.count / total) * 100) : 0;
                    return (
                        <button
                            key={stage.key}
                            onClick={() => onStageClick?.(stage.key)}
                            className="w-full text-left group"
                        >
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[12px] font-semibold text-ink-700">{stage.label}</span>
                                <span className="num text-[12px] text-ink-500">{stage.count} · {pct}%</span>
                            </div>
                            <div className="h-7 rounded-control bg-surface overflow-hidden">
                                <div
                                    className={cn(STAGE_COLORS[i] || 'bg-ink-400', 'h-full rounded-control flex items-center px-2.5 transition-all duration-500 group-hover:brightness-105')}
                                    style={{ width: `${Math.max(4, pct)}%` }}
                                >
                                    {pct >= 12 && <span className="text-white text-[11px] font-bold">{stage.count}</span>}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            {biggestDrop && (
                <p className="text-[12px] text-ink-500 font-medium">
                    Biggest drop: <strong className="text-ink-700">{biggestDrop.from} → {biggestDrop.to}</strong> ({biggestDrop.dropPct}% drop). Consider tightening your audience or testing new copy here.
                </p>
            )}
        </div>
    );
}

function findBiggestDrop(stages: Stage[]) {
    if (stages.length < 2) return null;
    let worst: { from: string; to: string; fromCount: number; toCount: number; dropPct: number } | null = null;
    for (let i = 0; i < stages.length - 1; i++) {
        const a = stages[i], b = stages[i + 1];
        if (a.count === 0) continue;
        const dropPct = Math.round(((a.count - b.count) / a.count) * 100);
        if (dropPct <= 0) continue;
        if (!worst || dropPct > worst.dropPct) {
            worst = { from: a.label, to: b.label, fromCount: a.count, toCount: b.count, dropPct };
        }
    }
    return worst;
}
