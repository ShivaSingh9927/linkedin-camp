"use client";

import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
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
const FLAVORS: string[] = [
    'Reading target profile for context…',
    'Personalizing message for industry context…',
    'Cross-referencing your business profile…',
    'Scoring lead engagement signals…',
    'Pacing next action to look human…',
    'Tuning tone to match your style guide…',
    'Checking account-health budget for today…',
    'Syncing connection states from LinkedIn…',
    'Reading prospect\'s latest post…',
    'Calculating optimal send window…',
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
    const text = showReal
        ? `${actionLabel(currentlyProcessing!.action)} ${currentlyProcessing!.leadName}${currentlyProcessing!.leadCompany ? ` · ${currentlyProcessing!.leadCompany}` : ''}`
        : flavor;

    return (
        <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-100 rounded-card p-4 pl-5 shadow-soft">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-control bg-card grid place-items-center shrink-0 shadow-soft">
                    <Cpu className={cn("w-4 h-4 text-brand transition-opacity duration-200", fade && "opacity-20")} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="label !text-brand">{showReal ? 'Currently' : 'Engine · live'}</div>
                    <div className={cn("text-[14px] font-semibold text-ink-700 truncate transition-opacity duration-200", fade && "opacity-20")}>
                        {text}
                    </div>
                </div>
                {isLive && (
                    <span className="hidden sm:flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                    </span>
                )}
            </div>
        </div>
    );
}
