'use client';

import { useState, useEffect } from 'react';
import {
    Linkedin,
    CheckCircle2,
    RefreshCcw,
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type LoginStep = 'CREDENTIALS' | 'VERIFICATION' | 'SYNCING' | 'SUCCESS';

export default function LinkedInConnection() {
    const [status, setStatus] = useState<{
        connected: boolean;
        profile?: any;
    } | null>(null);
    const [step, setStep] = useState<LoginStep>('CREDENTIALS');
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFACode, setTwoFACode] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            const res = await fetch(`${apiBase}/api/v1/auth/linkedin-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
            if (data.connected) setStep('SUCCESS');
        } catch (error) {
            console.error('Failed to fetch status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleInitialLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setStep('SYNCING');

        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            const res = await fetch(`${apiBase}/api/v1/auth/start-simulation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (data.success) {
                if (data.requires2FA) {
                    setStep('VERIFICATION');
                    toast.info('Security code required');
                } else if (data.connected) {
                    setStep('SUCCESS');
                    fetchStatus();
                }
            } else {
                setError(data.error || 'Login failed');
                setStep('CREDENTIALS');
            }
        } catch (err) {
            setError('Connection error. Please check your internet.');
            setStep('CREDENTIALS');
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep('SYNCING');
        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            const res = await fetch(`${apiBase}/api/v1/auth/submit-2fa`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: twoFACode })
            });

            const data = await res.json();
            if (data.success && data.connected) {
                setStep('SUCCESS');
                fetchStatus();
            } else {
                setError(data.error || 'Verification failed');
                setStep('VERIFICATION');
            }
        } catch (err) {
            setError('Sync error');
            setStep('VERIFICATION');
        }
    };

    if (loading) return (
        <div className="h-64 flex items-center justify-center">
            <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="max-w-xl mx-auto space-y-8">
            <div className="bg-white rounded-[2.5rem] border shadow-2xl shadow-slate-200/50 overflow-hidden">
                {/* Header Profile Section (If Success) */}
                <AnimatePresence mode="wait">
                    {step === 'SUCCESS' ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-12 text-center space-y-6"
                        >
                            <div className="relative inline-block">
                                <div className="w-24 h-24 bg-[#0077b5] rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-[#0077b5]/30">
                                    <Linkedin className="w-12 h-12 text-white" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-accent rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-slate-900">Synchronized!</h2>
                                <p className="text-slate-500 font-medium">Your account is now guarded by a Dedicated ISP Proxy.</p>
                            </div>
                            <div className="flex justify-center pt-4">
                                <div className="px-5 py-2.5 bg-accent/10 rounded-2xl flex items-center gap-2 text-accent text-sm font-bold">
                                    <ShieldCheck className="w-4 h-4" />
                                    SECURE CLOUD READY
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="contents">
                            {/* LinkedIn-Style Branding */}
                            <div className="p-8 pb-4 flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-10 h-10 bg-[#0077b5] rounded-xl flex items-center justify-center shadow-lg shadow-[#0077b5]/20">
                                        <Linkedin className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-2xl font-black text-[#0077b5] tracking-tight">Sync</span>
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 text-center">
                                    {step === 'CREDENTIALS' && 'Login to LinkedIn'}
                                    {step === 'VERIFICATION' && 'Security Check'}
                                    {step === 'SYNCING' && 'Establishing Connection...'}
                                </h1>
                                <p className="text-slate-500 text-sm mt-2 text-center max-w-[80%]">
                                    {step === 'CREDENTIALS' && "Connect your account securely to automate your outreach via our cloud network."}
                                    {step === 'VERIFICATION' && "LinkedIn noticed a new login from our secure ISP Proxy. Enter your code below."}
                                </p>
                            </div>

                            <div className="p-12 pt-4">
                                <AnimatePresence mode="wait">
                                    {step === 'CREDENTIALS' && (
                                        <motion.form
                                            key="login"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            onSubmit={handleInitialLogin}
                                            className="space-y-5"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    window.postMessage({ type: 'LINKEDIN_CAMP_FORCE_SYNC' }, '*');
                                                    toast.info('Opening secure sync window...');
                                                }}
                                                className="w-full group relative flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-slate-900/10 hover:bg-black transition-all active:scale-[0.98]"
                                            >
                                                <div className="w-6 h-6 bg-[#0077b5] rounded-md flex items-center justify-center">
                                                    <Linkedin className="w-4 h-4 text-white" />
                                                </div>
                                                One-Click Extension Sync
                                                <div className="absolute -top-3 -right-2 px-2 py-1 bg-accent text-white text-[10px] font-black rounded-lg shadow-lg rotate-12 scale-90">
                                                    RECOMMENDED
                                                </div>
                                            </button>

                                            <div className="relative my-6">
                                                <div className="absolute inset-0 flex items-center">
                                                    <span className="w-full border-t border-slate-100" />
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase">
                                                    <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">Or Securely Connect With</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type="email"
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0077b5] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                                                            placeholder="Email or Phone"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0077b5] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                                                            placeholder="Password"
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0077b5] transition-colors"
                                                        >
                                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {error && (
                                                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                className="w-full bg-[#0077b5] text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-[#0077b5]/20 hover:bg-[#006396] transition-all active:scale-[0.98] disabled:opacity-50"
                                            >
                                                Sign In
                                            </button>

                                            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                                                By signing in, you agree to our 24/7 dedicated proxy protection.
                                                Your credentials are encrypted and never stored on disk.
                                            </p>
                                        </motion.form>
                                    )}

                                    {step === 'VERIFICATION' && (
                                        <motion.form
                                            key="2fa"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            onSubmit={handleVerify2FA}
                                            className="space-y-6"
                                        >
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                                                    <Smartphone className="w-8 h-8 text-[#0077b5]" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700">Check your inbox</p>
                                                    <p className="text-xs text-slate-500">We've sent a 6-digit code to your email.</p>
                                                </div>
                                            </div>

                                            <input
                                                type="text"
                                                maxLength={6}
                                                value={twoFACode}
                                                onChange={(e) => setTwoFACode(e.target.value)}
                                                placeholder="000000"
                                                className="w-full text-center text-4xl tracking-[0.5em] font-black py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0077b5] focus:bg-white outline-none transition-all"
                                                required
                                            />

                                            {error && (
                                                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                className="w-full bg-[#0077b5] text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-[#0077b5]/20 hover:bg-[#006396] transition-all"
                                            >
                                                Submit Code
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setStep('CREDENTIALS')}
                                                className="w-full text-sm font-bold text-slate-400 hover:text-[#0077b5] transition-colors"
                                            >
                                                Back to Login
                                            </button>
                                        </motion.form>
                                    )}

                                    {step === 'SYNCING' && (
                                        <motion.div
                                            key="syncing"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="py-12 flex flex-col items-center space-y-6"
                                        >
                                            <div className="relative">
                                                <div className="w-20 h-20 border-4 border-[#0077b5]/20 border-t-[#0077b5] rounded-full animate-spin" />
                                                <div className="absolute inset-0 m-auto w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                                    <RefreshCcw className="w-6 h-6 text-[#0077b5] animate-pulse" />
                                                </div>
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="font-bold text-slate-700 animate-pulse uppercase tracking-[0.2em] text-xs">Connecting to Proxy</p>
                                                <p className="text-xs text-slate-400 italic">"Please wait, we are securing your signal..."</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Privacy Shield */}
            <div className="flex items-center justify-center gap-2 text-slate-400">
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">256-Bit SSL Encrypted Connection</span>
            </div>
        </div>
    );
}
