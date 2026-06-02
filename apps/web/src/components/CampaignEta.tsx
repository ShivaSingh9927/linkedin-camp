"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Clock } from 'lucide-react';

interface Props {
    campaignId: string;
    compact?: boolean;
}

interface EtaPayload {
    leadCount: number;
    estimatedActions: number;
    businessDays: number;
    calendarDays: number;
    completionDate: string;
}

// Tiny inline ETA pill. Shows estimated finish date for ACTIVE / QUEUED
// campaigns so users self-regulate lead counts (the single biggest UX
// lever against the "added 5 sequences, nothing's moving" complaint).
export function CampaignEta({ campaignId, compact = false }: Props) {
    const [eta, setEta] = useState<EtaPayload | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get(`/campaigns/${campaignId}/eta`)
            .then(res => { if (!cancelled) setEta(res.data); })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [campaignId]);

    if (error || !eta || eta.leadCount === 0) return null;

    const date = new Date(eta.completionDate);
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (compact) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground" title={`${eta.leadCount} leads · ~${eta.businessDays} business days`}>
                <Clock className="w-3 h-3" />
                ~{label}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-500/5 px-2 py-1 rounded-full border border-blue-500/10" title={`${eta.leadCount} leads · ~${eta.businessDays} business days at 58 actions/day`}>
            <Clock className="w-3 h-3" />
            Est. finish ~{label}
        </span>
    );
}
