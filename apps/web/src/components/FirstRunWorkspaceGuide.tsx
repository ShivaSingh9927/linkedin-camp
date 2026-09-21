'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, MessageSquareText, PanelRight, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACTIVATION_DISMISSED_KEY } from '@/components/copilot/ActivationCopilot';

const steps = [
    {
        icon: MessageSquareText,
        eyebrow: 'Start here',
        title: 'Tell Qampi who you want to reach',
        body: 'Ask in plain language. Qampi turns your goal into a focused LinkedIn search and explains the criteria before it runs.',
        target: 'Your copilot',
    },
    {
        icon: PanelRight,
        eyebrow: 'Review as you go',
        title: 'Decide in the workspace, not the chat',
        body: 'Matched people and campaign choices open beside the conversation, so details stay visible while you choose what happens next.',
        target: 'Leads & campaigns',
    },
    {
        icon: Activity,
        eyebrow: 'Stay in control',
        title: 'Check status without losing your place',
        body: 'Use Status at any time to see activity and limits. One click returns you to the leads or campaign you were working on.',
        target: 'Live status',
    },
] as const;

export function FirstRunWorkspaceGuide() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const current = steps[step];
    const Icon = current.icon;
    const lastStep = step === steps.length - 1;

    const finish = () => {
        try { localStorage.setItem(ACTIVATION_DISMISSED_KEY, '1'); } catch { /* ignore */ }
        router.replace('/');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 p-4 backdrop-blur-[2px] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-run-guide-title"
        >
            <motion.div
                key={step}
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md overflow-hidden rounded-card border border-line bg-card shadow-lift"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand-400 to-violet-300" />
                <div className="p-6 sm:p-7">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-control bg-brand-50 text-brand">
                            <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-chip bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                            {step + 1} of {steps.length}
                        </span>
                    </div>

                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">{current.eyebrow}</p>
                    <h2 id="first-run-guide-title" className="mt-1.5 text-[22px] font-semibold tracking-tight text-foreground">
                        {current.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-ink-600">{current.body}</p>

                    <div className="mt-5 flex items-center gap-2 rounded-control border border-brand-100 bg-brand-50/50 px-3 py-2.5">
                        <span className="h-2 w-2 rounded-full bg-brand" />
                        <span className="text-[12px] font-medium text-ink-700">On this screen: {current.target}</span>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3">
                        <button onClick={finish} className="text-xs font-medium text-ink-500 hover:text-foreground">
                            Skip tour
                        </button>
                        <div className="flex items-center gap-2">
                            {step > 0 && (
                                <button onClick={() => setStep((value) => value - 1)} className="inline-flex h-9 items-center gap-1 rounded-control border border-line px-3 text-xs font-medium text-ink-700 hover:bg-surface">
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                                </button>
                            )}
                            <button onClick={lastStep ? finish : () => setStep((value) => value + 1)} className="inline-flex h-9 items-center gap-1 rounded-control bg-brand px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-600">
                                {lastStep ? <>Let&apos;s start <Check className="h-3.5 w-3.5" /></> : <>Next <ArrowRight className="h-3.5 w-3.5" /></>}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
