'use client';

import { useEffect, useState } from 'react';
import { Shield, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';

interface QuotaEntry {
    action: string;
    used: number;
    cap: number;
    remaining: number;
    exhausted: boolean;
}

// LinkedIn enforces rate limits at the ACCOUNT level (not per campaign).
// This badge surfaces today's running totals so users see how close they
// are to the cap before launching more work. Counts come from the same
// ActionLog the engine reads at its pre-flight gate, so what you see here
// is exactly what the engine will allow next.
const LABELS: Record<string, string> = {
    'connect': 'Invites',
    'send-message': 'Messages',
};

export function SafetyQuotaBadge() {
    const [quotas, setQuotas] = useState<QuotaEntry[]>([]);

    useEffect(() => {
        let mounted = true;
        const fetchQuota = async () => {
            try {
                const res = await api.get('/safety/quota');
                if (mounted) setQuotas(res.data?.quotas || []);
            } catch {}
        };
        fetchQuota();
        const t = setInterval(fetchQuota, 60_000);
        return () => { mounted = false; clearInterval(t); };
    }, []);

    if (!quotas.length) return null;

    const anyExhausted = quotas.some(q => q.exhausted);

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${anyExhausted ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                {anyExhausted ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                <span>Daily Safety</span>
            </div>
            {quotas.map(q => {
                const label = LABELS[q.action] || q.action;
                const pct = q.cap ? Math.min(100, Math.round((q.used / q.cap) * 100)) : 0;
                const tone = q.exhausted
                    ? 'bg-destructive/10 border-destructive/30 text-destructive'
                    : pct >= 80
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                        : 'bg-muted/60 border-border text-foreground';
                return (
                    <div
                        key={q.action}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest ${tone}`}
                        title={`${q.used} of ${q.cap} ${label.toLowerCase()} used today. Resets at 09:00 UTC tomorrow.`}
                    >
                        <span>{label}</span>
                        <span className="font-black tabular-nums">{q.used}/{q.cap}</span>
                    </div>
                );
            })}
        </div>
    );
}
