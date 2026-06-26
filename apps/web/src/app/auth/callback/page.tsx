'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingScreen } from '@/components/ui';
import { track } from '@/lib/analytics';

// Landing spot for the Microsoft/LinkedIn redirect flow. The backend bounces
// here with either ?token=... (success) or ?error=... (failure), stores the
// token, then routes onward. AuthWrapper exempts this path so it can run before
// a token exists.
const ERROR_COPY: Record<string, string> = {
    missing_code: 'Sign-in was cancelled.',
    invalid_state: 'Sign-in expired, please try again.',
    no_id_token: 'The provider did not return your identity.',
    no_email: 'Your account has no email we can use.',
    exchange_failed: 'Could not complete sign-in. Please try again.',
};

export default function AuthCallbackPage() {
    const router = useRouter();
    const params = useSearchParams();
    const handled = useRef(false);
    const [message, setMessage] = useState('Finishing sign-in…');

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;

        const token = params.get('token');
        const error = params.get('error');

        if (error || !token) {
            toast.error(ERROR_COPY[error || ''] || 'Sign-in failed. Please try again.');
            router.replace('/login');
            return;
        }

        localStorage.setItem('token', token);
        // Minimal cached user; AuthWrapper hydrates the rest from /users/me.
        const step = params.get('step') || 'STARTED';
        localStorage.setItem('user', JSON.stringify({ registrationStep: step }));
        if (params.get('new') === '1') track('signup_completed', { provider: 'oauth_redirect' });
        toast.success('Signed in');
        setMessage('Signed in — redirecting…');
        router.replace(step === 'STARTED' ? '/onboarding' : '/');
    }, [params, router]);

    return <LoadingScreen fullScreen label={message} />;
}
