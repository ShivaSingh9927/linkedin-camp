'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import api from '@/lib/api';
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
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    loading?: boolean;
    email: string;
    setEmail: (val: string) => void;
    password?: string;
    setPassword?: (val: string) => void;
}

const testimonials: Testimonial[] = [
    {
        avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        name: "Alex Thompson",
        handle: "Founder, Growthly",
        text: "Leadmate transformed our LinkedIn outreach. We've seen a 300% increase in connection rates."
    },
    {
        avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        name: "Sarah Chen",
        handle: "SDR Lead @ ScaleFlow",
        text: "The ghost architecture is a game changer. I feel 100% safe running my campaigns now."
    }
];

export function AuthLayout({
    type,
    title,
    description,
    onSubmit,
    loading,
    email,
    setEmail,
    password,
    setPassword
}: AuthLayoutProps) {
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const handleGoogleSuccess = async (response: any) => {
        try {
            const { data } = await api.post('/auth/google', {
                credential: response.credential
            });

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            toast.success('Successfully logged in with Google');

            if (data.user.registrationStep === 'STARTED') {
                router.push('/onboarding');
            } else {
                router.push('/');
            }
        } catch (error: any) {
            console.error('Google login error:', error);
            toast.error(error.response?.data?.error || 'Failed to login with Google');
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row w-full bg-background overflow-hidden">
            {/* Left column: form */}
            <section className="flex-1 flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4 mb-8 animate-element animate-delay-100">
                            <img 
                                src="/leadmate_wbg.png" 
                                alt="Leadmate Logo" 
                                className="w-12 h-12 object-contain opacity-95 drop-shadow-lg"
                            />
                            <div>
                                <span className="text-3xl font-black text-foreground tracking-tight leading-none block">LEADMATE</span>
                                <span className="text-[12px] font-black text-primary tracking-[0.3em] uppercase mt-1 block">LinkedIn Hero</span>
                            </div>
                        </div>

                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground font-medium">{description}</p>

                        <form className="space-y-5" onSubmit={onSubmit}>
                            <div className="animate-element animate-delay-300">
                                <label className="text-sm font-bold text-muted-foreground ml-1">Email Address</label>
                                <div className="mt-1 rounded-2xl border border-border bg-muted/30 backdrop-blur-sm transition-all focus-within:border-primary/50 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/5">
                                    <input
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="name@company.com"
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none font-medium"
                                    />
                                </div>
                            </div>

                            {setPassword && (
                                <div className="animate-element animate-delay-400">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-sm font-bold text-muted-foreground">Password</label>
                                        {type === 'login' && (
                                            <Link href="#" className="text-xs font-bold text-primary hover:underline">Forgot password?</Link>
                                        )}
                                    </div>
                                    <div className="mt-1 rounded-2xl border border-border bg-muted/30 backdrop-blur-sm transition-all focus-within:border-primary/50 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/5">
                                        <div className="relative">
                                            <input
                                                name="password"
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                placeholder="••••••••"
                                                className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none font-medium"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-3 flex items-center p-2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {type === 'login' && (
                                <div className="animate-element animate-delay-500 flex items-center gap-3 ml-1">
                                    <input type="checkbox" id="remember" className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                                    <label htmlFor="remember" className="text-sm font-bold text-muted-foreground cursor-pointer">Keep me signed in</label>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {type === 'login' ? 'Sign In to Dashboard' : 'Create My Account'}
                            </button>
                        </form>

                        <div className="animate-element animate-delay-700 relative flex items-center justify-center py-2">
                            <span className="w-full border-t border-border"></span>
                            <span className="px-4 text-xs font-bold text-muted-foreground bg-background absolute uppercase tracking-widest">Or continue with</span>
                        </div>

                        <div className="animate-element animate-delay-800 flex justify-center">
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

                        <p className="animate-element animate-delay-900 text-center text-sm font-bold text-muted-foreground">
                            {type === 'login' ? (
                                <>New to Leadmate? <Link href="/register" className="text-primary hover:underline transition-colors">Create Account</Link></>
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
                                    <p className="text-white/90 text-sm leading-relaxed font-medium">"{t.text}"</p>
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
