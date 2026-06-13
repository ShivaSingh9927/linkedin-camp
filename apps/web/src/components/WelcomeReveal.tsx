'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Users, Lightbulb, Target, Building2, PenTool, ArrowRight, Check } from 'lucide-react';
import api from '@/lib/api';

/**
 * First-run reveal. Fires when the dashboard is opened with ?welcome=1 (set by
 * onboarding). Instead of dumping the just-onboarded user on a cold widget grid,
 * we run the website-based business inference and reveal "here's what I learned
 * about your business" — the AI proving itself before asking for anything else.
 *
 * Three terminal states:
 *  - revealed: we inferred a profile → show it, let them confirm or refine.
 *  - empty: no website / nothing scrapeable → gentle nudge to add details.
 * Either way the overlay dismisses by stripping the query param.
 */
export function WelcomeReveal() {
    const router = useRouter();
    const params = useSearchParams();
    const active = params.get('welcome') === '1';

    const [phase, setPhase] = useState<'analyzing' | 'revealed' | 'empty'>('analyzing');
    const [u, setU] = useState<any>(null);

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.post('/strategy/infer-from-website', {});
                if (cancelled) return;
                if (data?.understanding?.summary) {
                    setU(data.understanding);
                    setPhase('revealed');
                } else {
                    setPhase('empty');
                }
            } catch {
                if (!cancelled) setPhase('empty');
            }
        })();
        return () => { cancelled = true; };
    }, [active]);

    const dismiss = () => router.replace('/');

    if (!active) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 sm:p-10 relative overflow-hidden"
                >
                    <Sparkles className="absolute -right-8 -top-8 w-40 h-40 text-primary/5" />

                    {phase === 'analyzing' && (
                        <div className="relative text-center py-8">
                            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reading your business…</h2>
                            <p className="text-sm text-slate-500 font-medium mt-2 max-w-xs mx-auto">
                                Studying your website to understand what you do, who you sell to, and how to position you.
                            </p>
                        </div>
                    )}

                    {phase === 'revealed' && u && (
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Here&apos;s what I understand</h2>
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">From your website</p>
                                </div>
                            </div>

                            {u.summary && <p className="text-sm font-bold text-slate-800 leading-relaxed mb-4">{u.summary}</p>}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                                {u.youAre && <Pill icon={Building2} color="text-indigo-500" label="You are" value={u.youAre} />}
                                {u.youTarget && <Pill icon={Users} color="text-primary" label="You target" value={u.youTarget} />}
                                {u.youSolve && <Pill icon={Target} color="text-rose-500" label="You solve" value={u.youSolve} />}
                                {u.yourEdge && <Pill icon={Lightbulb} color="text-amber-500" label="Your edge" value={u.yourEdge} />}
                            </div>

                            {Array.isArray(u.voice) && u.voice.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap mb-6">
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <PenTool className="w-3.5 h-3.5" /> Your voice
                                    </span>
                                    {u.voice.map((v: string, i: number) => (
                                        <span key={i} className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">{v}</span>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={dismiss}
                                    className="flex-1 bg-primary text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Looks right — let&apos;s go
                                </button>
                                <button
                                    onClick={() => router.replace('/settings/ai-profile')}
                                    className="sm:w-40 bg-slate-100 text-slate-700 py-3.5 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    Refine <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-center text-[11px] font-semibold text-slate-400 mt-3">
                                I&apos;ll learn even more once you connect your LinkedIn account.
                            </p>
                        </div>
                    )}

                    {phase === 'empty' && (
                        <div className="relative text-center py-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                                <Sparkles className="w-7 h-7 text-primary" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Let&apos;s get me up to speed</h2>
                            <p className="text-sm text-slate-500 font-medium mt-2 max-w-sm mx-auto mb-6">
                                I couldn&apos;t learn enough from your website yet. Tell me a little about your business and
                                I&apos;ll build your strategy — or connect LinkedIn and I&apos;ll study your profile.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => router.replace('/settings/ai-profile')}
                                    className="flex-1 bg-primary text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
                                >
                                    Tell me about your business
                                </button>
                                <button
                                    onClick={dismiss}
                                    className="sm:w-32 bg-slate-100 text-slate-700 py-3.5 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                                >
                                    Later
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function Pill({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2.5 bg-slate-50 rounded-2xl p-3 border border-slate-100">
            <Icon className={`w-4 h-4 ${color} mt-0.5 flex-shrink-0`} />
            <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                <p className="text-sm font-black text-slate-900">{value}</p>
            </div>
        </div>
    );
}
