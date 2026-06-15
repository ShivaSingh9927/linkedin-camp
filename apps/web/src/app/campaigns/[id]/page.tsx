"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pause, Play, Download, Trash2, Pencil, Loader2, GitBranch, Users, UserPlus, Check, Send, MessageCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { Card, StatTile, Badge, Button, Skeleton } from '@/components/ui';
import { LiveStatusRibbon } from '@/components/LiveStatusRibbon';
import { CampaignFunnel } from '@/components/CampaignFunnel';
import { SevenDayChart } from '@/components/SevenDayChart';
import { CampaignLeadsTab } from '@/components/CampaignLeadsTab';
import { CampaignMessagesTab } from '@/components/CampaignMessagesTab';
import { CampaignPerformanceTab } from '@/components/CampaignPerformanceTab';
import { CampaignCrmTab } from '@/components/CampaignCrmTab';

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

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'brand' | 'neutral'> = {
    ACTIVE: 'success', QUEUED: 'info', PAUSED: 'warning', COMPLETED: 'brand', CANCELLED: 'neutral', DRAFT: 'neutral',
};
const STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Running', QUEUED: 'Queued', PAUSED: 'Paused', COMPLETED: 'Completed', CANCELLED: 'Cancelled', DRAFT: 'Draft',
};

export default function CampaignOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const [overview, setOverview] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'messages' | 'performance' | 'crm'>('overview');
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
                <p className="text-lg font-bold text-foreground">{error}</p>
                <Link href="/campaigns" className="label !text-brand inline-flex items-center gap-1.5 hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to campaigns
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Breadcrumb */}
            <Link href="/campaigns" className="label !text-brand inline-flex items-center gap-1 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Campaigns
            </Link>

            {loading || !overview ? (
                <HeaderSkeleton />
            ) : (
                <Header overview={overview} onPauseResume={handlePauseResume} onExport={handleExport} onDelete={handleDelete} />
            )}

            {/* Live ribbon — only while the campaign is actively running */}
            {overview?.status === 'ACTIVE' && (
                <LiveStatusRibbon currentlyProcessing={overview.currentlyProcessing ?? null} isLive />
            )}

            {/* KPI grid */}
            {loading || !overview ? <KpisSkeleton /> : <KpiGrid kpis={overview.kpis} />}

            {/* Progress bar */}
            {overview && (
                <Card className="p-5 space-y-2">
                    <div className="flex justify-between">
                        <span className="label">Progress</span>
                        <span className="num text-[12px] text-ink-500">{overview.progressPct}%</span>
                    </div>
                    <div className="h-2.5 bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${overview.progressPct}%` }} />
                    </div>
                </Card>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-line overflow-x-auto">
                {(['overview', 'leads', 'messages', 'performance', 'crm'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={cn(
                            'px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap capitalize -mb-px',
                            activeTab === t ? 'text-brand border-brand' : 'text-ink-500 border-transparent hover:text-foreground',
                        )}
                    >
                        {t === 'leads' && overview?.kpis.totalLeads != null ? <>Leads <span className="opacity-70">{overview.kpis.totalLeads}</span></> : t}
                    </button>
                ))}
            </div>

            <div>
                {activeTab === 'overview' && (
                    <FunnelAndChart campaignId={id} onStageClick={(s) => { setActiveTab('leads'); setLeadsInitialStage(s); }} />
                )}
                {activeTab === 'leads' && <CampaignLeadsTab campaignId={id} initialStage={leadsInitialStage} />}
                {activeTab === 'messages' && <CampaignMessagesTab campaignId={id} />}
                {activeTab === 'performance' && <CampaignPerformanceTab campaignId={id} />}
                {activeTab === 'crm' && <CampaignCrmTab campaignId={id} />}
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
                    <Card className="p-8 h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    </Card>
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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-[26px] font-bold tracking-tight leading-none text-foreground truncate">{overview.name}</h1>
                    <Link href={`/campaigns/${overview.id}/builder`} className="text-ink-400 hover:text-brand"><Pencil className="w-4 h-4" /></Link>
                </div>
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <Badge tone={STATUS_TONE[overview.status]} dot>
                        {STATUS_LABEL[overview.status] || overview.status}{overview.queuePosition ? ` #${overview.queuePosition}` : ''}
                    </Badge>
                    <span className="text-[13px] text-ink-500 font-medium">
                        Day {daysElapsed} of ~{overview.estimatedTotalDays} · Started {fmt(started)} · Est. finish {fmt(finish)}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={onPauseResume}>
                    {isActive ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Start</>}
                </Button>
                <Button variant="outline" onClick={onExport}><Download className="w-4 h-4" /> Export</Button>
                <Link href={`/campaigns/${overview.id}/builder`}><Button variant="dark"><GitBranch className="w-4 h-4" /> Edit sequence</Button></Link>
                <button onClick={onDelete} title="Delete" className="w-9 h-9 grid place-items-center rounded-control text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
        </div>
    );
}

function HeaderSkeleton() {
    return (
        <div className="flex justify-between items-start gap-6">
            <div className="space-y-3 flex-1">
                <Skeleton className="h-8 w-2/3 rounded-control" />
                <Skeleton className="h-4 w-1/2 rounded-control" />
            </div>
            <Skeleton className="h-9 w-40 rounded-control" />
        </div>
    );
}

// ─── KPI grid ─────────────────────────────────────────────────────────────

function KpiGrid({ kpis }: { kpis: Kpis }) {
    // Measured counts only. Reply rate lives in the Performance tab — showing
    // "0%" up top reads as broken before any replies exist.
    const cards = [
        { label: 'Leads', value: kpis.totalLeads, icon: Users, tone: 'brand' as const },
        { label: 'Invited', value: kpis.invited, icon: UserPlus, tone: 'warning' as const },
        { label: 'Connected', value: kpis.connected, icon: Check, tone: 'success' as const },
        { label: 'Messaged', value: kpis.messaged, icon: Send, tone: 'info' as const },
        { label: 'Replied', value: kpis.replied, icon: MessageCircle, tone: 'brand' as const },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map(card => (
                <StatTile key={card.label} icon={card.icon} value={card.value.toLocaleString()} label={card.label} tone={card.tone} />
            ))}
        </div>
    );
}

function KpisSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-card" />)}
        </div>
    );
}
