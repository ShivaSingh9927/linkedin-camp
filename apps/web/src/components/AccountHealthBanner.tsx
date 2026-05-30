'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Link2Off } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { OtpRecoveryModal } from './OtpRecoveryModal';

// Sticky top banner shown whenever the user's LinkedIn account isn't HEALTHY.
//
// Polls /session/health every 30s. While healthy: renders nothing (no DOM
// noise). Once degraded: shows a prominent banner with a "Re-verify" CTA
// that opens the recovery modal. After successful recovery the polling
// catches the flip back to HEALTHY and the banner disappears.

type Health = 'HEALTHY' | 'OTP_REQUIRED' | 'SESSION_EXPIRED' | 'RESTRICTED' | 'NEEDS_LOGIN';

interface HealthResponse {
    accountHealth: Health;
    accountHealthReason: string | null;
    accountHealthAt: string | null;
    linkedinEmail: string | null;
}

const COPY: Record<Exclude<Health, 'HEALTHY'>, { title: string; body: string; icon: React.ComponentType<any> }> = {
    OTP_REQUIRED: {
        title: 'LinkedIn needs verification',
        body: 'LinkedIn sent a verification code to your email. Re-verify to resume campaigns.',
        icon: ShieldAlert,
    },
    SESSION_EXPIRED: {
        title: 'Your LinkedIn session expired',
        body: 'Log in again to resume campaigns.',
        icon: Link2Off,
    },
    RESTRICTED: {
        title: 'LinkedIn flagged a challenge',
        body: 'LinkedIn is asking for additional verification we can\'t do automatically. Please re-log in.',
        icon: AlertTriangle,
    },
    NEEDS_LOGIN: {
        title: 'Re-login required',
        body: 'Log in again to resume campaigns.',
        icon: Link2Off,
    },
};

export function AccountHealthBanner() {
    const [data, setData] = useState<HealthResponse | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function fetchHealth() {
            try {
                const res = await api.get<HealthResponse>('/session/health');
                if (mounted) setData(res.data);
            } catch {
                // 401 / network — render nothing rather than show stale state.
                if (mounted) setData(null);
            }
        }
        fetchHealth();
        const t = setInterval(fetchHealth, 30_000);
        return () => { mounted = false; clearInterval(t); };
    }, []);

    if (!data || data.accountHealth === 'HEALTHY') return null;
    const copy = COPY[data.accountHealth];
    if (!copy) return null;
    const Icon = copy.icon;

    return (
        <>
            <div className="w-full border-b border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1800px] flex items-center gap-3 py-2.5">
                    <Icon className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-amber-900 dark:text-amber-100">{copy.title}</div>
                        <div className="text-xs text-amber-800/80 dark:text-amber-200/80 truncate">{copy.body}</div>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => setOpen(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        Re-verify now
                    </Button>
                </div>
            </div>
            <OtpRecoveryModal
                open={open}
                onClose={() => setOpen(false)}
                defaultEmail={data.linkedinEmail || undefined}
            />
        </>
    );
}
