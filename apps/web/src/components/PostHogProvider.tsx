'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { POSTHOG_KEY, POSTHOG_HOST, analyticsEnabled } from '@/lib/analytics';

// Routes where we never want session replay running — they show LinkedIn login,
// OTP codes, and OAuth tokens. Belt-and-suspenders on top of input masking.
const REPLAY_BLOCKLIST = ['/login', '/register', '/auth/callback', '/onboarding'];

if (typeof window !== 'undefined' && POSTHOG_KEY && !posthog.__loaded) {
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Only create person profiles once we identify() — keeps anonymous
        // traffic off the event/profile quota.
        person_profiles: 'identified_only',
        // We send SPA pageviews manually below (App Router has no full reloads).
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
            // Mask every input value (emails, the LinkedIn login fields, OTP,
            // tokens). Add a `ph-no-capture` class to any element that should be
            // blacked out in replays (lead tables, cookie blobs, etc.).
            maskAllInputs: true,
        },
    });
}

function PageviewTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!analyticsEnabled() || !pathname) return;

        // Pause/resume replay on sensitive routes.
        const blocked = REPLAY_BLOCKLIST.some((p) => pathname.startsWith(p));
        if (blocked) posthog.stopSessionRecording();
        else posthog.startSessionRecording();

        let url = window.origin + pathname;
        const qs = searchParams?.toString();
        if (qs) url += `?${qs}`;
        posthog.capture('$pageview', { $current_url: url });
    }, [pathname, searchParams]);

    return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    if (!POSTHOG_KEY) return <>{children}</>;
    return (
        <PHProvider client={posthog}>
            <Suspense fallback={null}>
                <PageviewTracker />
            </Suspense>
            {children}
        </PHProvider>
    );
}
