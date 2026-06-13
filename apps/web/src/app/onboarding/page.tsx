'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Briefcase,
    Linkedin,
    Globe,
    Sparkles,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

/**
 * Minimal-ask onboarding.
 *
 * We deliberately ask for almost nothing: name/email already came from
 * registration, so here we only need the job title (one line of self-context),
 * the LinkedIn profile URL (required — it's the spine of every automation and
 * the source the AI will analyze once the account is connected), and the
 * company website (optional — the seed for our first-pass business inference).
 *
 * Everything else — company, ICP, pain points, value prop, GTM — is INFERRED
 * from the website + LinkedIn profile and shown back for the user to confirm.
 * Asking the user to type all of that themselves would defeat the entire point
 * of having an AI strategist.
 */
export default function OnboardingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    const [jobTitle, setJobTitle] = useState('');
    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [website, setWebsite] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try { setUser(JSON.parse(storedUser)); } catch {}
        }
    }, []);

    const handleSubmit = async () => {
        if (!linkedinUrl.trim()) {
            toast.error('Your LinkedIn profile URL is required to run automations.');
            return;
        }
        setLoading(true);
        try {
            await api.put('/users/onboarding', {
                jobTitle: jobTitle.trim() || undefined,
                linkedinUrl: linkedinUrl.trim(),
                website: website.trim() || undefined,
            });

            const updatedUser = { ...user, registrationStep: 'COMPLETED' };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Hand off to the dashboard in its "analyzing" state so the AI can
            // reveal what it learned, rather than dumping the user on a cold
            // widget grid. ?welcome=1 triggers that first-run reveal.
            router.push('/?welcome=1');
        } catch (error: any) {
            console.error('Onboarding submission error:', error);
            toast.error(error.response?.data?.error || 'Failed to complete onboarding');
            setLoading(false);
        }
    };

    const firstName = user?.firstName ? `, ${user.firstName}` : '';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <img src="/qampi_wbg.png" alt="Logo" className="w-14 h-14 object-contain animate-in zoom-in duration-1000" />
                    </div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight sm:text-4xl">
                        Welcome{firstName} — let&apos;s get to know you
                    </h1>
                    <p className="text-muted-foreground font-medium mt-3 max-w-md mx-auto">
                        Just two things. From these, the AI figures out your business, your ICP and your
                        positioning — so you don&apos;t have to fill out a long form.
                    </p>
                </div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 p-8 sm:p-12 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

                    <div className="space-y-7">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                                Your LinkedIn Profile URL <span className="text-red-500">*</span>
                            </label>
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <Linkedin className="w-5 h-5" />
                                </div>
                                <input
                                    value={linkedinUrl}
                                    onChange={e => setLinkedinUrl(e.target.value)}
                                    placeholder="https://www.linkedin.com/in/username"
                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold px-1">
                                The AI will study this profile to learn your voice once you connect your account.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Company Website <span className="text-slate-400 normal-case font-bold">(optional, but recommended)</span>
                            </label>
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <input
                                    value={website}
                                    onChange={e => setWebsite(e.target.value)}
                                    placeholder="https://yourcompany.com"
                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold px-1">
                                We read your site to draft your company description, ICP and positioning — you just confirm it.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Your Role <span className="text-slate-400 normal-case font-bold">(optional)</span>
                            </label>
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <Briefcase className="w-5 h-5" />
                                </div>
                                <input
                                    value={jobTitle}
                                    onChange={e => setJobTitle(e.target.value)}
                                    placeholder="e.g. Founder, Sales Manager, SDR"
                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    <span>Let the AI analyze my business</span>
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>

                <p className="text-center mt-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50">
                    Qampi AI &copy; 2026 • Powered by Cloud Simulations
                </p>
            </div>
        </div>
    );
}
