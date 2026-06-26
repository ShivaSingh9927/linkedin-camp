'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import api from '@/lib/api';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export interface Testimonial {
    avatarSrc: string;
    name: string;
    handle: string;
    text: string;
}

interface AuthLayoutProps {
    type: 'login' | 'register';
    title: string;
    description: string;
}

// Where the browser-redirect providers (Microsoft, LinkedIn) start. The backend
// handles the whole OAuth dance and bounces back to /auth/callback with a token.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const testimonials: Testimonial[] = [
    {
        avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        name: "Alex Thompson",
        handle: "Founder, Growthly",
        text: "Qampi transformed our LinkedIn outreach. We've seen a 300% increase in connection rates."
    },
    {
        avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        name: "Sarah Chen",
        handle: "SDR Lead @ ScaleFlow",
        text: "The ghost architecture is a game changer. I feel 100% safe running my campaigns now."
    }
];

function MicrosoftIcon() {
    return (
        <svg viewBox="0 0 23 23" className="w-5 h-5" aria-hidden>
            <rect x="1" y="1" width="10" height="10" fill="#F25022" />
            <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
            <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
            <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
        </svg>
    );
}

function LinkedInIcon() {
    return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#0A66C2" aria-hidden>
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
    );
}

export function AuthLayout({ type, title, description }: AuthLayoutProps) {
    const router = useRouter();

    const handleGoogleSuccess = async (response: any) => {
        try {
            const { data } = await api.post('/auth/google', { credential: response.credential });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.isNewUser) track('signup_completed', { provider: 'google' });
            toast.success('Signed in with Google');
            router.push(data.user.registrationStep === 'STARTED' ? '/onboarding' : '/');
        } catch (error: any) {
            console.error('Google login error:', error);
            toast.error(error.response?.data?.error || 'Failed to sign in with Google');
        }
    };

    // Microsoft + LinkedIn are full-page redirects handled server-side.
    const goToProvider = (provider: 'microsoft' | 'linkedin') => {
        window.location.href = `${API_BASE}/auth/oauth/${provider}/start`;
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row w-full bg-background overflow-hidden">
            {/* Left column: provider buttons */}
            <section className="flex-1 flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4 mb-4 animate-element animate-delay-100">
                            <img
                                src="/qampi_wbg.png"
                                alt="Qampi Logo"
                                className="w-12 h-12 object-contain opacity-95 drop-shadow-lg"
                            />
                            <div>
                                <span className="text-3xl font-black text-foreground tracking-tight leading-none block">QAMPI</span>
                                <span className="text-[12px] font-black text-primary tracking-[0.3em] uppercase mt-1 block">LinkedIn Hero</span>
                            </div>
                        </div>

                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground font-medium">{description}</p>

                        <div className="flex flex-col gap-3 mt-2">
                            {/* Google one-tap */}
                            <div className="animate-element animate-delay-300 flex justify-center [&>div]:w-full [&_iframe]:!w-full">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => toast.error('Google Sign-In failed')}
                                    shape="pill"
                                    theme="filled_blue"
                                    size="large"
                                    width="380"
                                    text={type === 'login' ? 'signin_with' : 'signup_with'}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => goToProvider('microsoft')}
                                className="animate-element animate-delay-400 w-full rounded-full border border-border bg-background py-3.5 px-4 font-bold text-foreground hover:bg-muted/50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm"
                            >
                                <MicrosoftIcon />
                                {type === 'login' ? 'Sign in with Microsoft' : 'Sign up with Microsoft'}
                            </button>

                            <button
                                type="button"
                                onClick={() => goToProvider('linkedin')}
                                className="animate-element animate-delay-500 w-full rounded-full border border-border bg-background py-3.5 px-4 font-bold text-foreground hover:bg-muted/50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm"
                            >
                                <LinkedInIcon />
                                {type === 'login' ? 'Sign in with LinkedIn' : 'Sign up with LinkedIn'}
                            </button>
                        </div>

                        <p className="animate-element animate-delay-700 text-center text-xs font-medium text-muted-foreground leading-relaxed mt-2">
                            By continuing you agree to Qampi&apos;s Terms of Service and Privacy Policy.
                        </p>

                        <p className="animate-element animate-delay-900 text-center text-sm font-bold text-muted-foreground">
                            {type === 'login' ? (
                                <>New to Qampi? <Link href="/register" className="text-primary hover:underline transition-colors">Create Account</Link></>
                            ) : (
                                <>Already have an account? <Link href="/login" className="text-primary hover:underline transition-colors">Sign In</Link></>
                            )}
                        </p>
                    </div>
                </div>
            </section>

            {/* Right column: hero image + testimonials */}
            <section className="hidden md:flex flex-1 relative p-6">
                <div
                    className="animate-slide-right animate-delay-300 absolute inset-6 rounded-[3rem] bg-cover bg-center shadow-2xl overflow-hidden"
                    style={{ backgroundImage: `url('/auth-hero.jpeg')` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 px-8 scale-90 lg:scale-100">
                        <div className="flex gap-4">
                            {testimonials.map((t, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "animate-testimonial bg-white/10 backdrop-blur-2xl border border-white/20 p-6 rounded-[2.5rem] w-72 transition-all hover:bg-white/20",
                                        i === 0 ? "animate-delay-1000" : "animate-delay-1200 hidden xl:block"
                                    )}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <img src={t.avatarSrc} className="h-10 w-10 object-cover rounded-xl" alt="avatar" />
                                        <div>
                                            <p className="font-bold text-white text-sm">{t.name}</p>
                                            <p className="text-white/60 text-xs font-medium">{t.handle}</p>
                                        </div>
                                    </div>
                                    <p className="text-white/90 text-sm leading-relaxed font-medium">&quot;{t.text}&quot;</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-8 h-1.5 rounded-full bg-white" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
