"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, BellRing, Rocket, Loader2, RefreshCw, CheckSquare, Square } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// The two follow-up segments, each backed by a purpose-built campaign template.
const SEGMENTS = [
    {
        key: 'replied' as const,
        title: 'Replied · gone quiet',
        sub: 'They answered once, then went silent. Pick the conversation back up.',
        icon: MessageSquare,
        tone: 'text-emerald-600 bg-emerald-50',
        templateId: 'followup-replied-warm',
    },
    {
        key: 'noReply' as const,
        title: 'No reply yet',
        sub: 'They connected but never answered. Nudge them with a fresh angle.',
        icon: BellRing,
        tone: 'text-amber-600 bg-amber-50',
        templateId: 'followup-no-reply-nudge',
    },
];

interface FollowUpLead {
    id: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    company?: string;
    lastActivityAt?: string | null;
}

const ago = (iso?: string | null) => {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
};

export default function FollowUpsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [data, setData] = useState<{ replied: FollowUpLead[]; noReply: FollowUpLead[] }>({ replied: [], noReply: [] });
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const fetchFollowUps = async () => {
        setLoading(true);
        try {
            const res = await api.get('/leads/follow-ups');
            setData({ replied: res.data.replied || [], noReply: res.data.noReply || [] });
        } catch {
            setData({ replied: [], noReply: [] });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFollowUps(); }, []);

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const segmentLeads = (key: 'replied' | 'noReply') => (key === 'replied' ? data.replied : data.noReply);
    const selectedInSegment = (key: 'replied' | 'noReply') => segmentLeads(key).filter(l => selected.has(l.id));

    const toggleAll = (key: 'replied' | 'noReply') => {
        const leads = segmentLeads(key);
        const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
        setSelected(prev => {
            const next = new Set(prev);
            leads.forEach(l => (allSelected ? next.delete(l.id) : next.add(l.id)));
            return next;
        });
    };

    // Enroll the selected leads of one segment into its follow-up campaign.
    // Reuses the standard template-create → builder(pre-selected leads) flow:
    // the user lands in the builder with these leads ready, reviews, launches.
    const enroll = async (key: 'replied' | 'noReply', templateId: string) => {
        const ids = selectedInSegment(key).map(l => l.id);
        if (!ids.length) return;
        setEnrolling(true);
        try {
            const { data: tplRes } = await api.get(`/templates/${templateId}`);
            const tpl = tplRes.template;
            const { data: camp } = await api.post('/campaigns', {
                name: tpl.name,
                workflowJson: { ...tpl.workflow, locked: true },
                objective: tpl.aiStrategyHint?.objective,
                description: tpl.aiStrategyHint?.description,
                cta: tpl.aiStrategyHint?.cta,
                toneOverride: tpl.aiStrategyHint?.toneOverride,
            });
            router.push(`/campaigns/${camp.id}/builder?leadIds=${ids.join(',')}`);
        } catch {
            toast.error('Could not start the follow-up campaign.');
            setEnrolling(false);
        }
    };

    const total = data.replied.length + data.noReply.length;

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Follow-ups</h1>
                    <p className="text-sm font-semibold text-slate-500 mt-1">
                        Leads that earned a follow-up. Select who deserves another touch, then enroll them in a follow-up campaign.
                    </p>
                </div>
                <button
                    onClick={fetchFollowUps}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : total === 0 ? (
                <div className="bg-white rounded-3xl border shadow-sm p-20 text-center">
                    <Rocket className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-lg font-black text-slate-600">All caught up</p>
                    <p className="text-sm text-slate-400 mt-1">No leads are waiting on a follow-up right now.</p>
                </div>
            ) : (
                SEGMENTS.map((seg) => {
                    const leads = segmentLeads(seg.key);
                    if (!leads.length) return null;
                    const selCount = selectedInSegment(seg.key).length;
                    const allSelected = leads.every(l => selected.has(l.id));
                    const Icon = seg.icon;
                    return (
                        <section key={seg.key} className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className={cn('w-10 h-10 rounded-2xl grid place-items-center flex-shrink-0', seg.tone)}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                                            {seg.title}
                                            <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{leads.length}</span>
                                        </h2>
                                        <p className="text-[13px] font-medium text-slate-500 mt-0.5">{seg.sub}</p>
                                    </div>
                                </div>
                                <button onClick={() => toggleAll(seg.key)} className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:underline flex-shrink-0 mt-1">
                                    {allSelected ? 'Clear' : 'Select all'}
                                </button>
                            </div>

                            <ul className="divide-y divide-slate-50">
                                {leads.map((l) => {
                                    const checked = selected.has(l.id);
                                    return (
                                        <li key={l.id}>
                                            <button onClick={() => toggle(l.id)} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                                                {checked ? <CheckSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" /> : <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{[l.firstName, l.lastName].filter(Boolean).join(' ') || 'Unknown'}</p>
                                                    <p className="text-[12px] font-medium text-slate-400 truncate">{[l.jobTitle, l.company].filter(Boolean).join(' · ') || '—'}</p>
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">{ago(l.lastActivityAt)}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>

                            <div className="p-4 bg-slate-50/40 border-t border-slate-50 flex justify-end">
                                <button
                                    disabled={!selCount || enrolling}
                                    onClick={() => enroll(seg.key, seg.templateId)}
                                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-slate-900 transition-all"
                                >
                                    {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                                    Enroll {selCount || ''} → Follow-up campaign
                                </button>
                            </div>
                        </section>
                    );
                })
            )}
        </div>
    );
}
