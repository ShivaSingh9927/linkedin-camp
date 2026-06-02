"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plug, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface Policy {
    enabled: boolean;
    syncOnAdded: boolean;
    syncOnConnected: boolean;
    syncOnMessaged: boolean;
    syncOnReplied: boolean;
    syncOnBounced: boolean;
    syncOnCompleted: boolean;
    createTaskOnReply: boolean;
    ownerEmail: string | null;
}
interface PolicyResponse {
    policy: Policy;
    connected: { hubspot: boolean; pipedrive: boolean; notion: boolean };
    hasAnyCrm: boolean;
}
interface CrmEvent {
    id: string;
    event: string;
    provider: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | string;
    externalId: string | null;
    error: string | null;
    createdAt: string;
    lead: { firstName: string | null; lastName: string | null; company: string | null } | null;
}

interface Props { campaignId: string; }

const EVENT_ROWS: Array<{ key: keyof Policy; label: string; sub: string }> = [
    { key: 'syncOnAdded',     label: 'Lead added to campaign',  sub: 'Upsert contact in your CRM the moment they enter the campaign.' },
    { key: 'syncOnConnected', label: 'Connection accepted',     sub: 'Mark as warm. Lifecycle stage moves to "Lead".' },
    { key: 'syncOnMessaged',  label: 'AI message sent',         sub: 'Log every outbound message as a CRM activity. Noisy — opt-in.' },
    { key: 'syncOnReplied',   label: 'Lead replied',            sub: 'The signal that matters. Lifecycle → MQL, reply logged.' },
    { key: 'syncOnBounced',   label: 'Email bounced / invalid', sub: 'Mark email invalid so reps stop emailing the address.' },
    { key: 'syncOnCompleted', label: 'Campaign exhausted (no reply)', sub: 'Log "No response" so dormant leads are visible.' },
];

export function CampaignCrmTab({ campaignId }: Props) {
    const [data, setData] = useState<PolicyResponse | null>(null);
    const [events, setEvents] = useState<CrmEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const [p, e] = await Promise.all([
                api.get(`/campaigns/${campaignId}/crm-policy`),
                api.get(`/campaigns/${campaignId}/crm-events?limit=50`),
            ]);
            setData(p.data);
            setEvents(e.data.events || []);
        } catch { /* keep previous */ }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [campaignId]);

    const patch = async (patch: Partial<Policy>) => {
        if (!data) return;
        setSaving(true);
        const optimistic = { ...data, policy: { ...data.policy, ...patch } };
        setData(optimistic);
        try {
            const res = await api.put(`/campaigns/${campaignId}/crm-policy`, patch);
            setData(d => d ? { ...d, policy: res.data.policy } : d);
        } catch {
            setData(data); // revert
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-card border border-border rounded-[2.5rem] p-12 shadow-soft flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
        );
    }
    if (!data) return null;

    if (!data.hasAnyCrm) {
        return (
            <div className="bg-card border border-border rounded-[2.5rem] p-12 shadow-soft text-center space-y-4">
                <Plug className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No CRM connected yet.</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Connect HubSpot, Pipedrive, or Notion in Settings to keep your CRM in sync with this campaign automatically — every reply, accepted connection, and bounce.
                </p>
                <a href="/settings/integrations" className="inline-flex items-center gap-2 text-xs font-black text-violet-600 hover:underline uppercase tracking-widest">
                    Connect a CRM <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        );
    }

    const p = data.policy;

    return (
        <div className="space-y-6">
            {/* Provider status */}
            <div className="bg-card border border-border rounded-[2.5rem] p-6 lg:p-8 space-y-4 shadow-soft">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 className="text-xl font-black italic uppercase tracking-tight">CRM sync</h3>
                        <p className="text-xs text-slate-500 mt-1">Event-driven. Every lifecycle change pushes to your connected CRMs.</p>
                    </div>
                    <label className="inline-flex items-center gap-3 cursor-pointer">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Master switch</span>
                        <Toggle on={p.enabled} disabled={saving} onChange={v => patch({ enabled: v })} />
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                    {(['hubspot', 'pipedrive', 'notion'] as const).map(prov => (
                        <span key={prov} className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            data.connected[prov]
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-50 text-slate-400 border-slate-200"
                        )}>
                            {data.connected[prov] ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {prov}
                        </span>
                    ))}
                </div>
            </div>

            {/* Event toggles */}
            <div className={cn("bg-card border border-border rounded-[2.5rem] p-6 lg:p-8 space-y-1 shadow-soft", !p.enabled && "opacity-50 pointer-events-none")}>
                <h3 className="text-xl font-black italic uppercase tracking-tight mb-4">Sync on these events</h3>
                <div className="divide-y divide-slate-100">
                    {EVENT_ROWS.map(row => (
                        <div key={row.key} className="flex items-start justify-between gap-4 py-3">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-slate-800">{row.label}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{row.sub}</div>
                            </div>
                            <Toggle
                                on={!!p[row.key]}
                                disabled={saving}
                                onChange={v => patch({ [row.key]: v } as any)}
                            />
                        </div>
                    ))}
                </div>

                <div className="mt-5 pt-5 border-t border-slate-100 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-800">Create a follow-up task on reply</div>
                        <div className="text-xs text-slate-500 mt-0.5">When a lead replies, the CRM also creates a native task assigned to the owner — so the reply hits their daily to-do, not just the contact record.</div>
                    </div>
                    <Toggle on={p.createTaskOnReply} disabled={saving} onChange={v => patch({ createTaskOnReply: v })} />
                </div>

                <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-4">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Task owner</label>
                    <input
                        type="email"
                        defaultValue={p.ownerEmail || ''}
                        placeholder="you@company.com"
                        onBlur={e => {
                            const v = e.target.value.trim();
                            if (v !== (p.ownerEmail || '')) patch({ ownerEmail: v });
                        }}
                        className="flex-1 max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                    />
                </div>
            </div>

            {/* Recent activity */}
            <div className="bg-card border border-border rounded-[2.5rem] p-6 lg:p-8 space-y-4 shadow-soft">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xl font-black italic uppercase tracking-tight">Recent CRM activity</h3>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{events.length} most recent</span>
                </div>
                {events.length === 0 ? (
                    <p className="text-sm text-slate-500 italic py-6 text-center">No sync activity yet. As your campaign runs, every push to HubSpot/Pipedrive/Notion will appear here.</p>
                ) : (
                    <div className="space-y-2">
                        {events.map(e => {
                            const lead = e.lead;
                            const who = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unnamed lead' : 'Unknown lead';
                            return (
                                <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <StatusIcon status={e.status} />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-slate-800 truncate">
                                                <span className="text-violet-700">{e.event}</span> · {who}
                                                {lead?.company && <span className="text-slate-400"> · {lead.company}</span>}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate">
                                                {e.provider} · {e.status.toLowerCase()}
                                                {e.error && <span className="text-rose-600"> · {e.error}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {new Date(e.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
                on ? "bg-violet-600" : "bg-slate-200",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                on ? "translate-x-6" : "translate-x-1"
            )} />
        </button>
    );
}

function StatusIcon({ status }: { status: string }) {
    if (status === 'SUCCESS') return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
    if (status === 'FAILED')  return <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
    return <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />;
}
