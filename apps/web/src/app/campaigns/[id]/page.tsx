"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pause, Play, Download, Trash2, Pencil, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { LiveStatusRibbon } from '@/components/LiveStatusRibbon';
import { CampaignFunnel } from '@/components/CampaignFunnel';
import { SevenDayChart } from '@/components/SevenDayChart';
import { CampaignLeadsTab } from '@/components/CampaignLeadsTab';
import { CampaignMessagesTab } from '@/components/CampaignMessagesTab';
import { CampaignPerformanceTab } from '@/components/CampaignPerformanceTab';

interface Kpis {
    totalLeads: number;
    invited: number;
    connected: number;
    messaged: number;
    replied: number;
    replyRatePct: number;
}

interface Overview {
    id: string;
    name: string;
    status: 'DRAFT' | 'QUEUED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
    queuePosition: number | null;
    objective: string | null;
    startedAt: string;
    estimatedCompletionAt: string;
    estimatedTotalDays: number;
    progressPct: number;
    kpis: Kpis;
    currentlyProcessing: {
        action: string;
        leadName: string;
        leadCompany?: string | null;
        at: string;
    } | null;
}

const STATUS_STYLES: Record<string, string> = {
    ACTIVE:    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    QUEUED:    'bg-blue-500/10 text-blue-600 border-blue-500/20',
    PAUSED:    'bg-amber-500/10 text-amber-600 border-amber-500/20',
    COMPLETED: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    CANCELLED: 'bg-slate-200 text-slate-600 border-slate-300',
    DRAFT:     'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CampaignOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const [overview, setOverview] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'messages' | 'performance'>('overview');
    const [leadsInitialStage, setLeadsInitialStage] = useState('all');
    const socketRef = useRef<Socket | null>(null);

    const fetchOverview = async () => {
        try {
            const res = await api.get(`/campaigns/${id}/overview`);
            setOverview(res.data);
            setError(null);
        } catch (err: any) {
            if (err?.response?.status === 404) setError('Campaign not found');
            else setError('Failed to load campaign');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        fetchOverview();
        // Poll every 15s for KPI freshness — socket pushes drive the live
        // ribbon, but counters need a periodic refresh.
        const poll = setInterval(fetchOverview, 15000);
        return () => clearInterval(poll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Socket.IO for the "Currently …" ribbon: an event for THIS campaign
    // upgrades the ribbon from flavor copy to a real action immediately.
    useEffect(() => {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
        const s = io(apiBase);
        socketRef.current = s;
        const token = localStorage.getItem('token');
        if (token) s.emit('join_room', { token });
        s.on('campaign_activity', (data: any) => {
            if (data.campaignId !== id) return;
            setOverview(prev => prev ? ({
                ...prev,
                currentlyProcessing: {
                    action: data.node,
                    leadName: data.leadName || 'lead',
                    leadCompany: data.details?.company || null,
                    at: data.timestamp || new Date().toISOString(),
                },
            }) : prev);
            // Counter changes lag the socket; trigger a re-fetch.
            if (data.action === 'success') fetchOverview();
        });
        return () => { s.disconnect(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handlePauseResume = async () => {
        if (!overview) return;
        try {
            if (overview.status === 'ACTIVE') {
                await api.post(`/campaigns/${id}/pause`);
            } else {
                await api.post(`/campaigns/${id}/start`);
            }
            fetchOverview();
        } catch (err: any) {
            if (err?.response?.status === 409) {
                toast.error(err.response.data?.message || 'You already have an active campaign');
            } else if (err?.response?.status === 400 && err.response.data?.error === 'LEAD_CAP_EXCEEDED') {
                const { cap, provided } = err.response.data;
                toast.error(`Too many leads (${provided}/${cap}). Reduce or upgrade.`);
            } else {
                toast.error('Failed to update campaign');
            }
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this campaign and all its progress?')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            router.push('/campaigns');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleExport = async () => {
        try {
            const res = await api.get(`/campaigns/${id}/export?format=csv`);
            const blob = new Blob([res.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `campaign-${id.slice(0, 8)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Export failed');
        }
    };

    if (error) {
        return (
            <div className="p-10 text-center space-y-4">
                <p className="text-lg font-bold text-slate-700">{error}</p>
                <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm font-black text-violet-600 hover:underline uppercase tracking-widest">
                    <ArrowLeft className="w-4 h-4" /> Back to campaigns
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300">
            {/* Breadcrumb */}
            <Link href="/campaigns" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest">
                <ArrowLeft className="w-3 h-3" /> My Campaigns
            </Link>

            {loading || !overview ? (
                <HeaderSkeleton />
            ) : (
                <Header overview={overview} onPauseResume={handlePauseResume} onExport={handleExport} onDelete={handleDelete} />
            )}

            {/* Live ribbon — shown even during initial load with a placeholder */}
            <LiveStatusRibbon currentlyProcessing={overview?.currentlyProcessing ?? null} isLive={overview?.status === 'ACTIVE'} />

            {/* KPI grid */}
            {loading || !overview ? <KpisSkeleton /> : <KpiGrid kpis={overview.kpis} />}

            {/* Progress bar */}
            {overview && (
                <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-3 shadow-soft">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Progress</span>
                        <span className="text-xs font-black text-slate-700">{overview.progressPct}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-500"
                            style={{ width: `${overview.progressPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Funnel + 7-day chart */}
            <FunnelAndChart campaignId={id} onStageClick={(s) => { setActiveTab('leads'); setLeadsInitialStage(s); }} />

            {/* Tabs row */}
            <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-soft">
                <div className="border-b border-slate-200 flex items-center gap-1 px-4 lg:px-6 overflow-x-auto">
                    {(['overview', 'leads', 'messages', 'performance'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={cn(
                                "px-5 lg:px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] border-b-[3px] transition-colors whitespace-nowrap capitalize",
                                activeTab === t ? "text-foreground border-violet-500" : "text-muted-foreground border-transparent hover:text-violet-600"
                            )}
                        >
                            {t === 'leads' ? `Leads ${overview?.kpis.totalLeads ?? ''}` : t}
                        </button>
                    ))}
                </div>
                <div className="p-4 lg:p-6">
                    {activeTab === 'leads' && <CampaignLeadsTab campaignId={id} initialStage={leadsInitialStage} />}
                    {activeTab === 'messages' && <CampaignMessagesTab campaignId={id} />}
                    {activeTab === 'performance' && <CampaignPerformanceTab campaignId={id} />}
                    {activeTab === 'overview' && (
                        <div className="p-6 lg:p-8 text-center space-y-3">
                            <p className="text-sm font-bold text-slate-700">Scroll up for the overview, funnel, charts, and recent activity.</p>
                            <Link href={`/campaigns/${id}/builder`} className="inline-flex items-center gap-2 text-xs font-black text-violet-600 hover:underline uppercase tracking-widest">
                                Open the workflow builder →
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Wraps the funnel + 7-day chart so they share one /funnel fetch.
function FunnelAndChart({ campaignId, onStageClick }: { campaignId: string; onStageClick: (stage: string) => void }) {
    const [series, setSeries] = useState<any[] | null>(null);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await api.get(`/campaigns/${campaignId}/funnel`);
                if (!cancelled) setSeries(res.data.dailySeries);
            } catch {}
        };
        load();
        const t = setInterval(load, 30000);
        return () => { cancelled = true; clearInterval(t); };
    }, [campaignId]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <CampaignFunnel campaignId={campaignId} onStageClick={onStageClick} />
            </div>
            <div className="lg:col-span-1">
                {series ? <SevenDayChart data={series} /> : (
                    <div className="bg-card border border-border rounded-[2.5rem] p-8 h-full flex items-center justify-center shadow-soft">
                        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Header ───────────────────────────────────────────────────────────────

function Header({ overview, onPauseResume, onExport, onDelete }: {
    overview: Overview;
    onPauseResume: () => void;
    onExport: () => void;
    onDelete: () => void;
}) {
    const started = new Date(overview.startedAt);
    const finish = new Date(overview.estimatedCompletionAt);
    const daysElapsed = Math.max(1, Math.ceil((Date.now() - started.getTime()) / (24 * 60 * 60 * 1000)));
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const isActive = overview.status === 'ACTIVE';

    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-8 lg:p-10 shadow-soft">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-3 min-w-0 flex-1">
                    <div className="flex items-center gap-4 flex-wrap">
                        <h1 className="text-3xl lg:text-4xl font-black italic uppercase tracking-tight text-foreground truncate">{overview.name}</h1>
                        <Link href={`/campaigns/${overview.id}/builder`} className="text-xs font-bold text-slate-400 hover:text-slate-700 inline-flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> edit
                        </Link>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            STATUS_STYLES[overview.status]
                        )}>
                            {isActive && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            )}
                            {overview.status}{overview.queuePosition ? ` #${overview.queuePosition}` : ''}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">
                            Day {daysElapsed} of ~{overview.estimatedTotalDays} · Started {fmt(started)} · Est. finish {fmt(finish)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={onPauseResume}
                        className={cn(
                            "px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center gap-2",
                            isActive
                                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        )}
                    >
                        {isActive ? <><Pause className="w-3.5 h-3.5 fill-current" /> Pause</> : <><Play className="w-3.5 h-3.5 fill-current" /> Start</>}
                    </button>
                    <button onClick={onExport} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 inline-flex items-center gap-2">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <button onClick={onDelete} className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 inline-flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function HeaderSkeleton() {
    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-8 lg:p-10 shadow-soft">
            <div className="flex justify-between items-start gap-6">
                <div className="space-y-4 flex-1">
                    <div className="h-10 w-2/3 bg-slate-200 rounded-2xl animate-pulse" />
                    <div className="h-4 w-1/2 bg-slate-200 rounded-full animate-pulse" />
                </div>
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
        </div>
    );
}

// ─── KPI grid ─────────────────────────────────────────────────────────────

function KpiGrid({ kpis }: { kpis: Kpis }) {
    const cards: Array<{ label: string; value: string | number; accent?: string }> = [
        { label: 'Leads',      value: kpis.totalLeads },
        { label: 'Invited',    value: kpis.invited },
        { label: 'Connected',  value: kpis.connected },
        { label: 'Messaged',   value: kpis.messaged },
        { label: 'Replied',    value: kpis.replied, accent: 'text-purple-600' },
        { label: 'Reply rate', value: `${kpis.replyRatePct}%`, accent: 'text-emerald-600' },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map(card => (
                <div key={card.label} className="bg-card border border-border rounded-[1.5rem] p-5 space-y-2 shadow-soft">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{card.label}</div>
                    <div className={cn("text-3xl font-black tracking-tight", card.accent || 'text-foreground')}>
                        {card.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

function KpisSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-[1.5rem] p-5 space-y-3 shadow-soft">
                    <div className="h-3 w-1/2 bg-slate-200 rounded-full animate-pulse" />
                    <div className="h-8 w-2/3 bg-slate-200 rounded-xl animate-pulse" />
                </div>
            ))}
        </div>
    );
}
