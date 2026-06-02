"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, MessageSquare, Sparkles, User } from 'lucide-react';

interface Message {
    id: string;
    leadId: string;
    leadName: string;
    leadCompany: string | null;
    leadJobTitle: string | null;
    linkedinUrl: string | null;
    direction: 'OUTBOUND' | 'INBOUND' | string;
    content: string;
    source: 'AI' | 'MANUAL' | 'TEMPLATE' | string;
    sentAt: string;
    reply: { content: string; sentAt: string } | null;
}

interface Props {
    campaignId: string;
}

export function CampaignMessagesTab({ campaignId }: Props) {
    const [messages, setMessages] = useState<Message[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const limit = 50;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/campaigns/${campaignId}/messages`, { params: { page, limit } });
                if (!cancelled) { setMessages(res.data.messages); setTotal(res.data.total); }
            } catch { if (!cancelled) setMessages([]); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
    }, [campaignId, page]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (loading) {
        return (
            <div className="bg-card border border-border rounded-[2.5rem] p-12 shadow-soft flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
        );
    }

    if (!messages || messages.length === 0) {
        return (
            <div className="bg-card border border-border rounded-[2.5rem] p-12 shadow-soft text-center space-y-3">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">No messages sent yet.</p>
                <p className="text-xs text-slate-500">As your campaign runs, every AI-drafted message will appear here for your audit log.</p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-6 lg:p-8 space-y-6 shadow-soft">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-black italic uppercase tracking-tight">Messages</h3>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{total} total · full AI audit log</span>
            </div>
            <div className="space-y-4">
                {messages.map(m => {
                    const isOutbound = m.direction === 'OUTBOUND';
                    const isAI = m.source === 'AI';
                    return (
                        <div key={m.id} className={cn(
                            "border rounded-[1.5rem] p-5 space-y-3",
                            isOutbound ? "bg-violet-50/40 border-violet-200/60" : "bg-slate-50 border-slate-200"
                        )}>
                            <div className="flex items-start justify-between flex-wrap gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        {m.linkedinUrl ? (
                                            <a href={m.linkedinUrl} target="_blank" rel="noopener" className="font-bold text-slate-800 hover:text-violet-600 hover:underline">{m.leadName}</a>
                                        ) : <span className="font-bold text-slate-800">{m.leadName}</span>}
                                        {isAI && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700">
                                                <Sparkles className="w-2.5 h-2.5" /> AI
                                            </span>
                                        )}
                                        {!isAI && m.source && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">{m.source}</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500">{[m.leadJobTitle, m.leadCompany].filter(Boolean).join(' · ') || '—'}</div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                    {new Date(m.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {m.content}
                            </div>

                            {m.reply && (
                                <div className="mt-3 pt-3 border-t border-purple-200/50 flex gap-3 items-start">
                                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                        <User className="w-3.5 h-3.5 text-purple-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">⭐ Replied</span>
                                            <span className="text-[10px] font-bold text-slate-400">{new Date(m.reply.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-sm text-purple-900 italic">{m.reply.content}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {total > limit && (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                    <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
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
