"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CurrentlyProcessing {
    action: string;
    leadName: string;
    leadCompany?: string | null;
    at: string;
}

interface Props {
    currentlyProcessing: CurrentlyProcessing | null;
    isLive?: boolean;
}

// Flavor copy shown when no real action has happened in the last 60s.
// Each line is something the engine *actually* does, surfaced as
// human-readable subtext. Truthful narration, not fake activity.
const FLAVORS: Array<{ emoji: string; text: string }> = [
    { emoji: '🤖', text: 'Reading target profile for context…' },
    { emoji: '🧠', text: 'Personalizing message for industry context…' },
    { emoji: '✨', text: 'Cross-referencing your business profile…' },
    { emoji: '📊', text: 'Scoring lead engagement signals…' },
    { emoji: '⏳', text: 'Pacing next action to look human…' },
    { emoji: '🎯', text: 'Tuning tone to match your style guide…' },
    { emoji: '🛡', text: 'Checking account-health budget for today…' },
    { emoji: '🔄', text: 'Syncing connection states from LinkedIn…' },
    { emoji: '🕵', text: 'Reading prospect\'s latest post…' },
    { emoji: '⚙', text: 'Calculating optimal send window…' },
];

const ACTION_LABELS: Record<string, string> = {
    'connect': 'Sending invite to',
    'send-message': 'Drafting AI message for',
    'profile-visit': 'Visiting profile of',
    'connect-accept': 'Confirming acceptance for',
    'CRM_SYNC_HUBSPOT': 'Syncing to HubSpot for',
    'CRM_SYNC_PIPEDRIVE': 'Syncing to Pipedrive for',
};

function actionLabel(action: string): string {
    return ACTION_LABELS[action] || action.replace(/[-_]/g, ' ');
}

export function LiveStatusRibbon({ currentlyProcessing, isLive = true }: Props) {
    const [flavorIdx, setFlavorIdx] = useState(0);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        if (currentlyProcessing) return; // real action takes over — no rotation
        const interval = setInterval(() => {
            setFade(true);
            setTimeout(() => {
                setFlavorIdx(i => (i + 1) % FLAVORS.length);
                setFade(false);
            }, 250);
        }, 4500);
        return () => clearInterval(interval);
    }, [currentlyProcessing]);

    const flavor = FLAVORS[flavorIdx];
    const showReal = !!currentlyProcessing;
    const emoji = showReal ? '⚡' : flavor.emoji;
    const text = showReal
        ? `${actionLabel(currentlyProcessing!.action)} ${currentlyProcessing!.leadName}${currentlyProcessing!.leadCompany ? ` · ${currentlyProcessing!.leadCompany}` : ''}`
        : flavor.text;

    return (
        <div className="bg-gradient-to-r from-violet-50 via-white to-emerald-50 border border-violet-200/50 rounded-[2rem] p-6 shadow-soft">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <span className={cn("text-2xl transition-opacity duration-200", fade && "opacity-20")}>{emoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-1">
                        {showReal ? 'Currently' : 'Engine'}
                    </div>
                    <div className={cn("text-base lg:text-lg font-bold text-slate-800 truncate transition-opacity duration-200", fade && "opacity-20")}>
                        {text}
                    </div>
                </div>
                {isLive && (
                    <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-emerald-600 flex-shrink-0">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="uppercase tracking-widest">Live</span>
                    </div>
                )}
            </div>
        </div>
    );
}
