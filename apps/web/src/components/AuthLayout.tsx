'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
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

    return (
        <div className="min-h-screen flex flex-col md:flex-row w-full bg-background overflow-hidden">
            {/* Left column: form */}
            <section className="flex-1 flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4 mb-6 animate-element animate-delay-100">
                            <div className="w-14 h-14 bg-primary/10 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-primary/10">
                                <img 
                                    src="/leadmate_wbg.png" 
                                    alt="Leadmate Logo" 
                                    className="max-w-[140px] opacity-90 drop-shadow-2xl"
                                />
                            </div>
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

                        <button className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 font-bold hover:bg-muted transition-all active:scale-[0.98]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
                                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
                                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
                            </svg>
                            Google
                        </button>

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
