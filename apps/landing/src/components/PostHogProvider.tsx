'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { POSTHOG_KEY, POSTHOG_HOST, analyticsEnabled, track } from '@/lib/analytics';

// Marketing site has no leads/PII, so we record sessions freely (no masking).
// cross_subdomain_cookie lets PostHog carry the same person from qampi.com to
// app.qampi.com, so the signup funnel is continuous across both sites.
if (typeof window !== 'undefined' && POSTHOG_KEY && !posthog.__loaded) {
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false, // sent manually below (App Router has no reloads)
        capture_pageleave: true,
        autocapture: true,
        cross_subdomain_cookie: true,
        session_recording: { maskAllInputs: true },
    });
}

function Tracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!analyticsEnabled() || !pathname) return;
        let url = window.origin + pathname;
        const qs = searchParams?.toString();
        if (qs) url += `?${qs}`;
        posthog.capture('$pageview', { $current_url: url });
    }, [pathname, searchParams]);

    // Delegated listener: any click on an anchor pointing at /register or /login
    // fires a clean funnel event — covers every CTA on the site (and future
    // ones) without touching each button.
    useEffect(() => {
        if (!analyticsEnabled()) return;
        const onClick = (e: MouseEvent) => {
            const a = (e.target as HTMLElement)?.closest?.('a');
            const href = a?.getAttribute('href') || '';
            if (href.includes('/register')) track('signup_cta_clicked', { href, location: pathname });
            else if (href.includes('/login')) track('login_cta_clicked', { href, location: pathname });
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, [pathname]);

    return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    if (!POSTHOG_KEY) return <>{children}</>;
    return (
        <PHProvider client={posthog}>
            <Suspense fallback={null}>
                <Tracker />
            </Suspense>
            {children}
        </PHProvider>
    );
}
