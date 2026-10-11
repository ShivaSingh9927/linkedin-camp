'use client';

// TEMPORARY — email/password sign-in for the single allowlisted reviewer
// account (Razorpay review). Backed by /auth/review-login; see
// apps/backend/src/controllers/review-login.controller.ts for removal steps.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { AuthSky } from '@/components/AuthSky';

export default function EmailLoginPage() {
    const router = useRouter();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/auth/review-login')
            .then((r) => setEnabled(!!r.data?.enabled))
            .catch(() => setEnabled(false));
    }, []);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const { data } = await api.post('/auth/review-login', { email, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Signed in');
            // Straight to plans — that is what the reviewer is here to test.
            router.push('/pricing');
        } catch (err) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg || 'Sign-in failed. Please try again.');
            setBusy(false);
        }
    }

    return (
        <div className="relative min-h-[100dvh] flex items-center justify-center w-full overflow-hidden p-4 sm:p-6">
            <AuthSky />
            <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/60 bg-background/95 backdrop-blur-sm shadow-2xl px-5 py-8 sm:rounded-3xl sm:px-10 sm:py-12">
                <div className="flex flex-col items-center text-center gap-3">
                    <div className="flex items-center gap-3 mb-3">
                        <img src="/qampi_wbg.png" alt="Qampi Logo" className="w-11 h-11 object-contain" />
                        <span className="text-2xl font-black text-foreground tracking-tight leading-none">QAMPI</span>
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign in with email</h1>
                    <p className="text-sm text-muted-foreground font-medium">For test accounts provided by Qampi.</p>
                </div>

                {enabled === false ? (
                    <div className="mt-8 rounded-2xl bg-muted/60 p-5 text-center text-sm text-muted-foreground">
                        Email sign-in isn&apos;t available. Please continue with Google or LinkedIn.
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-8 flex flex-col gap-4 w-full max-w-[380px] mx-auto" noValidate>
                        <label className="flex flex-col gap-1.5 text-left">
                            <span className="text-sm font-semibold text-foreground">Email</span>
                            <input
                                type="email"
                                autoComplete="username"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-left">
                            <span className="text-sm font-semibold text-foreground">Password</span>
                            <input
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                        </label>

                        {error && (
                            <p role="alert" className="text-sm font-medium text-red-600">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={busy || enabled === null || !email || !password}
                            className="mt-1 h-11 rounded-full bg-primary text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                )}

                <p className="text-center text-sm font-bold text-muted-foreground mt-8">
                    <Link href="/login" className="text-primary hover:underline">
                        ← Back to Google / LinkedIn sign-in
                    </Link>
                </p>
            </div>
        </div>
    );
}
