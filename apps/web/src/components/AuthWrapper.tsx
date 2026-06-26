"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LoadingScreen } from '@/components/ui';
import api from '@/lib/api';
import { identifyUser } from '@/lib/analytics';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    // /auth/callback lands here mid-OAuth with no token yet — it stores the
    // token itself, so it must not be bounced to /login.
    const authRoutes = ['/login', '/register', '/auth/callback'];
    const onboardingRoute = '/onboarding';

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const token = localStorage.getItem('token');

            if (!token) {
                if (!authRoutes.includes(pathname)) router.push('/login');
                setLoading(false);
                return;
            }

            // Already authenticated and sitting on a login/register page → home.
            if (authRoutes.includes(pathname)) {
                router.push('/');
                return;
            }

            // Validate the token against the server and read the AUTHORITATIVE
            // registrationStep from there — never trust a possibly-stale cached
            // `user` blob. A stale token 401s here, which the api interceptor
            // turns into a clean logout→/login (no confusing redirect loop); a
            // valid token refreshes the cache so the onboarding gate is correct.
            let registrationStep: string | undefined;
            try {
                const { data } = await api.get('/users/me');
                if (cancelled) return;
                registrationStep = data?.registrationStep;
                // Tie analytics + replays to the real account (no PII beyond
                // what we already control; email/tier power funnel breakdowns).
                if (data?.id) identifyUser(data.id, { email: data.email, tier: data.tier });
                try {
                    const prev = JSON.parse(localStorage.getItem('user') || '{}');
                    localStorage.setItem('user', JSON.stringify({ ...prev, ...data }));
                } catch { /* ignore */ }
            } catch {
                // 401 is handled by the api interceptor (clears token → /login).
                // For other errors, fall back to the cached value so a transient
                // network blip doesn't lock the user out.
                if (cancelled) return;
                try {
                    registrationStep = JSON.parse(localStorage.getItem('user') || '{}').registrationStep;
                } catch { /* ignore */ }
            }

            if (registrationStep && registrationStep !== 'COMPLETED' && pathname !== onboardingRoute) {
                router.push(onboardingRoute);
                return;
            }
            if (registrationStep === 'COMPLETED' && pathname === onboardingRoute) {
                router.push('/');
                return;
            }

            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, [pathname, router]);

    if (loading && !authRoutes.includes(pathname)) {
        return <LoadingScreen fullScreen label="Signing you in…" />;
    }

    return <>{children}</>;
}
