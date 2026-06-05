"use client";

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, Trash2, Search, Loader2, Send, Plus } from 'lucide-react';
import { LeadEnrichmentDrawer, degreeLabel } from '@/components/LeadEnrichmentDrawer';

interface Lead {
    id: string;
    campaignLeadId: string;
    name: string;
    company: string | null;
    jobTitle: string | null;
    linkedinUrl: string;
    stage: string;
    lastActionAt: string | null;
    nextActionAt: string | null;
    // Enrichment captured by PROFILE_VISIT
    headline?: string | null;
    location?: string | null;
    email?: string | null;
    phone?: string | null;
    aboutInfo?: string | null;
    connectionDegree?: number | null;
    experience?: any;
    education?: any;
    enrichedAt?: string | null;
}

interface LeadsResponse {
    leads: Lead[];
    total: number;
    page: number;
    limit: number;
    stageCounts: {
        all: number;
        pending: number;
        in_progress: number;
        replied: number;
        completed: number;
        failed: number;
    };
}

interface Props {
    campaignId: string;
    initialStage?: string;
}

const STAGE_CHIPS: Array<{ key: string; label: string; styles: string }> = [
    { key: 'all',         label: 'All',         styles: 'bg-slate-900 text-white' },
    { key: 'pending',     label: 'Pending',     styles: 'bg-slate-100 text-slate-600' },
    { key: 'in_progress', label: 'In progress', styles: 'bg-slate-100 text-slate-600' },
    { key: 'replied',     label: '⭐ Replied',   styles: 'bg-purple-100 text-purple-700' },
    { key: 'completed',   label: 'Completed',   styles: 'bg-emerald-100 text-emerald-700' },
    { key: 'failed',      label: 'Failed',      styles: 'bg-red-100 text-red-700' },
];

const STAGE_PILL: Record<string, string> = {
    pending:     'bg-slate-100 text-slate-600 border-slate-200',
    connected:   'bg-blue-500/10 text-blue-600 border-blue-500/20',
    in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    replied:     'bg-purple-500/10 text-purple-600 border-purple-500/20',
    completed:   'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    bounced:     'bg-red-500/10 text-red-600 border-red-500/20',
    failed:      'bg-red-500/10 text-red-600 border-red-500/20',
    imported:    'bg-slate-100 text-slate-600 border-slate-200',
};

export function CampaignLeadsTab({ campaignId, initialStage = 'all' }: Props) {
    const [stage, setStage] = useState(initialStage);
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<LeadsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [detailLead, setDetailLead] = useState<Lead | null>(null);

    useEffect(() => { setStage(initialStage); setPage(1); }, [initialStage]);

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/campaigns/${campaignId}/leads`, {
                    params: { stage, q: q.trim() || undefined, page, limit: 50 },
                });
                if (!cancelled) {
                    setData(res.data);
                    setSelected(new Set()); // clear selection on filter change
                }
            } catch {
                if (!cancelled) setData(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        // debounce the search input
        const t = setTimeout(fetch, q ? 250 : 0);
        return () => { cancelled = true; clearTimeout(t); };
    }, [campaignId, stage, q, page]);

    const allSelected = useMemo(
        () => !!data?.leads.length && data.leads.every(l => selected.has(l.campaignLeadId)),
        [data, selected]
    );

    const toggleOne = (id: string) => {
        setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };
    const toggleAll = () => {
        if (!data) return;
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(data.leads.map(l => l.campaignLeadId)));
    };

    const exportSelected = () => {
        if (!data) return;
        const rows = data.leads.filter(l => selected.has(l.campaignLeadId));
        const header = 'Name,Company,Job Title,Stage,LinkedIn URL,Last Action At';
        const csv = [header, ...rows.map(r => [r.name, r.company, r.jobTitle, r.stage, r.linkedinUrl, r.lastActionAt]
            .map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `leads-${campaignId.slice(0, 8)}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}`);
    };

    const [movePickerOpen, setMovePickerOpen] = useState(false);
    const [otherCampaigns, setOtherCampaigns] = useState<Array<{ id: string; name: string; status: string }>>([]);
    const [bulkBusy, setBulkBusy] = useState(false);

    const openMovePicker = async () => {
        try {
            const res = await api.get('/campaigns');
            setOtherCampaigns((res.data || []).filter((c: any) => c.id !== campaignId));
            setMovePickerOpen(true);
        } catch {
            toast.error('Failed to load campaigns');
        }
    };

    const bulkSyncCRM = async () => {
        if (!data || !selected.size) return;
        if (!confirm(`Send ${selected.size} lead${selected.size === 1 ? '' : 's'} to your configured CRMs?`)) return;
        const leadIds = data.leads.filter(l => selected.has(l.campaignLeadId)).map(l => l.id);
        setBulkBusy(true);
        try {
            const res = await api.post(`/campaigns/${campaignId}/leads/bulk/crm-sync`, { leadIds });
            const { ok, failed, total } = res.data;
            if (failed) toast.error(`${ok}/${total} synced · ${failed} failed`);
            else toast.success(`Synced ${ok} lead${ok === 1 ? '' : 's'} to CRMs`);
            setSelected(new Set());
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Bulk sync failed');
        } finally {
            setBulkBusy(false);
        }
    };

    const bulkMove = async (targetCampaignId: string) => {
        if (!data || !selected.size) return;
        const leadIds = data.leads.filter(l => selected.has(l.campaignLeadId)).map(l => l.id);
        setBulkBusy(true);
        try {
            const res = await api.post(`/campaigns/${campaignId}/leads/bulk/move`, { leadIds, targetCampaignId });
            const { moved, blocked, total } = res.data;
            const msg = `Moved ${moved}/${total}${blocked ? ` · ${blocked} blocked (already in another campaign)` : ''}`;
            toast[moved ? 'success' : 'error'](msg);
            setSelected(new Set());
            setMovePickerOpen(false);
            const r = await api.get(`/campaigns/${campaignId}/leads`, { params: { stage, q, page, limit: 50 } });
            setData(r.data);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Move failed');
        } finally {
            setBulkBusy(false);
        }
    };

    const removeSelected = async () => {
        if (!data || !selected.size) return;
        if (!confirm(`Remove ${selected.size} lead${selected.size === 1 ? '' : 's'} from this campaign?`)) return;
        const ids = data.leads.filter(l => selected.has(l.campaignLeadId));
        let ok = 0, fail = 0;
        for (const l of ids) {
            try { await api.delete(`/campaigns/${campaignId}/leads/${l.id}`); ok++; } catch { fail++; }
        }
        toast[fail ? 'error' : 'success'](`Removed ${ok}${fail ? ` (${fail} failed)` : ''}`);
        setSelected(new Set());
        // re-fetch by bumping page state
        setPage(p => p);
        const res = await api.get(`/campaigns/${campaignId}/leads`, { params: { stage, q, page, limit: 50 } });
        setData(res.data);
    };

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-6 lg:p-8 space-y-6 shadow-soft">
            {/* Filter chips + search */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    {STAGE_CHIPS.map(chip => {
                        const count = data?.stageCounts?.[chip.key as keyof typeof data.stageCounts] ?? 0;
                        const isActive = stage === chip.key;
                        return (
                            <button
                                key={chip.key}
                                onClick={() => { setStage(chip.key); setPage(1); }}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                    isActive ? 'bg-slate-900 text-white' : `${chip.styles} hover:opacity-80`
                                )}
                            >
                                {chip.label} {count}
                            </button>
                        );
                    })}
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={q}
                        onChange={e => { setQ(e.target.value); setPage(1); }}
                        placeholder="Search name, company…"
                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                </div>
            </div>

            {/* Bulk-action bar — shown only when items selected */}
            {selected.size > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="text-sm font-bold text-violet-700 ml-2">{selected.size} selected</span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={exportSelected} className="px-3 py-2 bg-white border border-violet-300 text-violet-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-violet-100 inline-flex items-center gap-2">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                        <button onClick={bulkSyncCRM} disabled={bulkBusy} className="px-3 py-2 bg-white border border-orange-300 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-50 disabled:opacity-50 inline-flex items-center gap-2">
                            <Send className="w-3.5 h-3.5" /> Send to CRM
                        </button>
                        <button onClick={openMovePicker} disabled={bulkBusy} className="px-3 py-2 bg-white border border-blue-300 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 disabled:opacity-50 inline-flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" /> Move to campaign
                        </button>
                        <button onClick={removeSelected} className="px-3 py-2 bg-white border border-red-300 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 inline-flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left">
                            <th className="py-3 px-2 w-8">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                            </th>
                            <th className="py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Lead</th>
                            <th className="py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Email</th>
                            <th className="py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Location</th>
                            <th className="py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Stage</th>
                            <th className="py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Last action</th>
                            <th className="py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Next</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={7} className="py-16 text-center">
                                <Loader2 className="w-6 h-6 text-violet-500 animate-spin mx-auto" />
                            </td></tr>
                        ) : !data?.leads.length ? (
                            <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">
                                No leads match this filter.
                            </td></tr>
                        ) : data.leads.map(l => {
                            const isSelected = selected.has(l.campaignLeadId);
                            const pillClass = STAGE_PILL[l.stage] || 'bg-slate-100 text-slate-600 border-slate-200';
                            return (
                                <tr key={l.campaignLeadId} className={cn("hover:bg-slate-50 transition-colors", isSelected && "bg-violet-50/40")}>
                                    <td className="py-4 px-2">
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(l.campaignLeadId)} className="rounded" />
                                    </td>
                                    <td className="py-4 px-2">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setDetailLead(l)} className="font-bold text-slate-800 hover:text-violet-600 hover:underline text-left">{l.name}</button>
                                            {degreeLabel(l.connectionDegree) && (
                                                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">{degreeLabel(l.connectionDegree)}</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500">{[l.jobTitle, l.company].filter(Boolean).join(' · ') || l.headline || '—'}</div>
                                    </td>
                                    <td className="py-4 px-2 text-xs">
                                        {l.email ? <a href={`mailto:${l.email}`} className="text-violet-600 hover:underline">{l.email}</a> : <span className="text-slate-400">—</span>}
                                    </td>
                                    <td className="py-4 px-2 text-xs text-slate-600">{l.location || '—'}</td>
                                    <td className="py-4 px-2">
                                        <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", pillClass)}>
                                            {l.stage.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="py-4 px-2 text-xs text-slate-600">
                                        {l.lastActionAt ? new Date(l.lastActionAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td className="py-4 px-2 text-xs text-slate-600">
                                        {l.nextActionAt ? new Date(l.nextActionAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Enrichment detail drawer */}
            <LeadEnrichmentDrawer lead={detailLead as any} onClose={() => setDetailLead(null)} />

            {/* Move-to-campaign picker */}
            {movePickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMovePickerOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-black uppercase tracking-tight">Move {selected.size} lead{selected.size === 1 ? '' : 's'} to…</h3>
                            <p className="text-xs text-slate-500 mt-1">Active leads can't be moved if they're already running in another campaign.</p>
                        </div>
                        <div className="p-2 overflow-y-auto max-h-96">
                            {otherCampaigns.length === 0 ? (
                                <p className="p-4 text-sm text-slate-500 text-center">You only have this one campaign.</p>
                            ) : otherCampaigns.map(c => (
                                <button key={c.id} onClick={() => bulkMove(c.id)} disabled={bulkBusy} className="w-full text-left p-4 rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-800 truncate">{c.name}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.status}</div>
                                    </div>
                                    <span className="text-slate-400">→</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {data && data.total > data.limit && (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                    <span>Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40">← Prev</button>
                        <span className="font-bold">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40">Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}
