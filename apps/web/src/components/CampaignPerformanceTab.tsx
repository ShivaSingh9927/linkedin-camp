"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface Row { label: string; leads: number; replied: number; rate: number }
interface PerfData {
    overall: { totalLeads: number; replies: number; replyRatePct: number };
    byJobTitle: Row[];
    byCompany: Row[];
    replyTimeline: { date: string; replies: number }[];
}

interface Props { campaignId: string; }

export function CampaignPerformanceTab({ campaignId }: Props) {
    const [data, setData] = useState<PerfData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await api.get(`/campaigns/${campaignId}/performance`);
                if (!cancelled) setData(res.data);
            } catch { if (!cancelled) setData(null); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
    }, [campaignId]);

    if (loading) {
        return <div className="bg-card border border-border rounded-[2.5rem] p-12 flex items-center justify-center shadow-soft">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>;
    }
    if (!data) return null;

    return (
        <div className="space-y-6">
            <OverallCard overall={data.overall} timeline={data.replyTimeline} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BreakdownCard title="By job title" rows={data.byJobTitle} />
                <BreakdownCard title="By company"   rows={data.byCompany} />
            </div>
        </div>
    );
}

function OverallCard({ overall, timeline }: { overall: PerfData['overall']; timeline: PerfData['replyTimeline'] }) {
    const W = 700, H = 120, PAD = 20;
    const max = Math.max(1, ...timeline.map(t => t.replies));
    const xStep = (W - 2 * PAD) / Math.max(1, timeline.length - 1);
    const yFor = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
    const path = timeline.map((d, i) => `${i === 0 ? 'M' : 'L'} ${PAD + i * xStep} ${yFor(d.replies)}`).join(' ');

    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-6 shadow-soft">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-xl font-black italic uppercase tracking-tight">Reply rate · 14-day timeline</h3>
                <div className="flex items-center gap-6">
                    <Stat label="Leads" value={overall.totalLeads} />
                    <Stat label="Replies" value={overall.replies} accent="text-purple-600" />
                    <Stat label="Reply rate" value={`${overall.replyRatePct}%`} accent="text-emerald-600" big />
                </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-32">
                <defs>
                    <linearGradient id="perfGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                </defs>
                {timeline.length > 1 && (
                    <>
                        <path d={`${path} L ${PAD + (timeline.length - 1) * xStep} ${H - PAD} L ${PAD} ${H - PAD} Z`} fill="url(#perfGrad)" />
                        <path d={path} stroke="#a855f7" strokeWidth={3} fill="none" strokeLinejoin="round" />
                    </>
                )}
                {timeline.map((d, i) => (
                    <g key={d.date}>
                        <circle cx={PAD + i * xStep} cy={yFor(d.replies)} r={3} fill="#a855f7" />
                    </g>
                ))}
            </svg>
        </div>
    );
}

function Stat({ label, value, accent, big }: { label: string; value: string | number; accent?: string; big?: boolean }) {
    return (
        <div className="space-y-1">
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</div>
            <div className={`${big ? 'text-3xl' : 'text-xl'} font-black tracking-tight ${accent || 'text-foreground'}`}>{value}</div>
        </div>
    );
}

function BreakdownCard({ title, rows }: { title: string; rows: Row[] }) {
    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-5 shadow-soft">
            <h3 className="text-xl font-black italic uppercase tracking-tight">{title}</h3>
            {!rows.length ? (
                <p className="text-sm text-slate-500 italic">Not enough data yet — need at least 3 leads per group to draw a conclusion.</p>
            ) : (
                <div className="space-y-3">
                    {rows.map(r => {
                        const max = Math.max(...rows.map(x => x.rate), 1);
                        const pct = (r.rate / max) * 100;
                        return (
                            <div key={r.label} className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-700 truncate">{r.label}</span>
                                    <span className="font-black text-emerald-600 whitespace-nowrap ml-3">
                                        {r.rate}% · {r.replied}/{r.leads}
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
