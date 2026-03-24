'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Linkedin,
    CheckCircle2,
    RefreshCcw,
    ShieldCheck,
    AlertCircle,
    Eye,
    EyeOff,
    ExternalLink,
    Chrome,
    Zap,
    Globe,
    Lock,
    Smartphone,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type LinkStep = 'CHOICE' | 'CREDENTIALS' | 'PROGRESS' | '2FA' | 'SUCCESS';

export default function LinkedInConnectivity() {
    const [status, setStatus] = useState<{
        connected: boolean;
        cookie?: string;
        persistent?: boolean;
    } | null>(null);
    const [step, setStep] = useState<LinkStep>('CHOICE');
    const [showModal, setShowModal] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFACode, setTwoFACode] = useState('');
    
    // Status tracking
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMsg, setProgressMsg] = useState('Initiating secure cloud session...');

    useEffect(() => {
        setMounted(true);
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            const res = await fetch(`${apiBase}/api/v1/auth/linkedin-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
            return data;
        } catch (error) {
            return null;
        }
    };

    const handleStartSimulation = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setStep('PROGRESS');
        setLoading(true);
        setProgressMsg('Launching stealth browser on cloud...');

        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            
            // Step-by-step UI updates (simulated for better UX while backend works)
            setTimeout(() => setProgressMsg('Navigating to LinkedIn...'), 2000);
            setTimeout(() => setProgressMsg('Entering credentials safely...'), 5000);

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
                    setStep('2FA');
                    toast.info('LinkedIn security verification required');
                } else if (data.connected) {
                    setStep('SUCCESS');
                    fetchStatus();
                    toast.success('Successfully linked your account!');
                }
            } else {
                setError(data.error || 'Identity verification failed. Please check your credentials.');
                setStep('CREDENTIALS');
            }
        } catch (err) {
            setError('Connection error. Please ensure the cloud server is reachable.');
            setStep('CREDENTIALS');
        } finally {
            setLoading(false);
        }
    };

    const handleOneClickSync = () => {
        setStep('PROGRESS');
        setLoading(true);
        setProgressMsg('Waiting for extension to capture session...');
        
        window.postMessage({ type: 'LINKEDIN_CAMP_FORCE_SYNC' }, '*');
        toast.info('Opening secure sync window...', {
            description: 'Please login to LinkedIn in the new window.'
        });
        
        // Start polling for success
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            const statusData = await fetchStatus();
            
            if (statusData?.persistentPath) {
                setStep('SUCCESS');
                setShowModal(true);
                setLoading(false);
                clearInterval(interval);
                toast.success('Session synchronized & verified on cloud!');
            } else if (statusData?.connected) {
                // Cookies synced but backend verification might still be running
                setProgressMsg('Session captured. Verifying on Hetzner node...');
            } else if (attempts > 30) {
                 // After 2.5 mins of nothing
                 setProgressMsg('Waiting for you to login manually...');
            }
        }, 5000);
        
        // Timeout after 5 mins
        setTimeout(() => {
            clearInterval(interval);
            if (step === 'PROGRESS') {
                setStep('CHOICE');
                setLoading(false);
            }
        }, 300000);
    };

    const handlePhase1Sync = async () => {
        setLoading(true);
        setStep('PROGRESS');
        setProgressMsg('Launching manual sync window on server...');
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            
            const res = await fetch(`${apiBase}/api/v1/auth/start-phase1-sync`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}` 
                }
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Manual sync window opened on server!');
                setProgressMsg('Please login manually in the server browser window.');
                
                // Poll for status
                const interval = setInterval(async () => {
                    const statusData = await fetchStatus();
                    if (statusData?.persistentSessionPath) {
                        setStep('SUCCESS');
                        clearInterval(interval);
                        toast.success('Persistent session synced successfully!');
                    }
                }, 10000);
            } else {
                setError(data.error || 'Failed to start manual sync.');
                setStep('CHOICE');
            }
        } catch (err) {
            setError('Connection error.');
            setStep('CHOICE');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setStep('PROGRESS');
        setProgressMsg('Verifying security code...');

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
                toast.success('Identity verified! Session saved.');
            } else {
                setError(data.error || 'Invalid or expired code.');
                setStep('2FA');
            }
        } catch (err) {
            setError('Sync error during verification.');
            setStep('2FA');
        } finally {
            setLoading(false);
        }
    };

    const modalContent = (
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !loading && setShowModal(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-border/50 flex flex-col max-h-[95vh]"
                    >
                        <div className="overflow-y-auto scrollbar-hide py-8 px-8 sm:px-12">
                            {/* Header Section */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-[#0077b5] rounded-xl flex items-center justify-center shadow-lg shadow-[#0077b5]/20">
                                        <Linkedin className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 leading-none">LINK SIGNAL</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Hetzner Cloud Endpoint</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-110 shadow-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Secure Node</span>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {step === 'CHOICE' && (
                                    <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                        <div className="space-y-2 text-center pb-4">
                                            <h3 className="text-2xl font-black text-slate-900 italic tracking-tight">STALL DETECTED</h3>
                                            <p className="text-sm text-slate-500 font-medium">To run automation on our Hetzner Cloud, we need to establish a dedicated session for you.</p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <button 
                                                onClick={() => {
                                                    window.postMessage({ type: 'LINKEDIN_CAMP_FORCE_SYNC' }, '*');
                                                    toast.info('Opening secure sync window...');
                                                    setShowModal(false);
                                                }}
                                                className="group relative text-left p-6 bg-slate-900 rounded-[2rem] border-2 border-transparent hover:bg-black hover:shadow-2xl transition-all"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="w-10 h-10 rounded-2xl bg-[#0077b5] flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                                        <Chrome className="w-5 h-5" />
                                                    </div>
                                                    <div className="px-2 py-1 bg-accent text-white text-[8px] font-black rounded-lg shadow-lg rotate-12">
                                                        RECOMMENDED
                                                    </div>
                                                </div>
                                                <h4 className="font-black text-white uppercase text-xs tracking-wider">One-Click Extension Sync</h4>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Instant & Secure. Opens original LinkedIn login page.</p>
                                            </button>

                                            <div className="relative my-2">
                                                <div className="absolute inset-0 flex items-center">
                                                    <span className="w-full border-t border-slate-100" />
                                                </div>
                                                <div className="relative flex justify-center text-[8px] uppercase">
                                                    <span className="bg-white px-2 text-slate-300 font-bold tracking-widest text-[8px]">Or use cloud simulation</span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => setStep('CREDENTIALS')}
                                                className="group text-left p-6 bg-slate-50 rounded-[2rem] border-2 border-transparent hover:border-primary/20 hover:bg-white hover:shadow-xl transition-all"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                        <Zap className="w-5 h-5" />
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                                                </div>
                                                <h4 className="font-black text-slate-900 uppercase text-xs tracking-wider">Cloud Native Sync</h4>
                                                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase opacity-60">Enter credentials once to unlock 24/7 cloud speed.</p>
                                            </button>

                                            <button 
                                                onClick={handlePhase1Sync}
                                                className="group text-left p-6 bg-amber-50 rounded-[2rem] border-2 border-transparent hover:border-amber-200 hover:bg-white hover:shadow-xl transition-all"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                                        <Globe className="w-5 h-5" />
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                                                </div>
                                                <h4 className="font-black text-amber-900 uppercase text-xs tracking-wider">Manual Server Sync</h4>
                                                <p className="text-[10px] text-amber-600/70 font-bold mt-1 uppercase opacity-60">Launch a browser on the server to login manually (Bio-Stealth).</p>
                                            </button>
                                        </div>
                                        <button onClick={() => setShowModal(false)} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Maybe Later</button>
                                    </motion.div>
                                )}

                                {step === 'CREDENTIALS' && (
                                    <motion.form key="creds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleStartSimulation} className="space-y-5">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">LinkedIn Email</label>
                                                <input 
                                                    type="email" 
                                                    value={email} 
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="e.g. user@company.com"
                                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    value={password} 
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    required
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-5 bottom-[14px] text-slate-300 hover:text-slate-900 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100 italic">
                                                <AlertCircle className="w-4 h-4" />
                                                <span>{error}</span>
                                            </div>
                                        )}

                                        <button 
                                            type="submit" 
                                            className="w-full h-14 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:translate-y-[-2px] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                        >
                                            <span>Initialize Sync</span>
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        
                                        <div className="flex items-center justify-center space-x-2 text-slate-400">
                                            <Lock className="w-3 h-3" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Encrypted Cloud Tunnel</span>
                                        </div>
                                    </motion.form>
                                )}

                                {step === 'PROGRESS' && (
                                    <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center space-y-8 text-center">
                                        <div className="relative">
                                            <div className="w-24 h-24 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                                            <div className="absolute inset-0 m-auto w-12 h-12 bg-white rounded-[1.5rem] shadow-2xl flex items-center justify-center">
                                                <RefreshCcw className="w-6 h-6 text-primary animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-black text-slate-900 italic tracking-tight">{progressMsg}</h3>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Please do not close this modal. Your session is being secured.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {step === '2FA' && (
                                    <motion.form key="2fa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleVerify2FA} className="space-y-6">
                                        <div className="flex flex-col items-center text-center space-y-4">
                                            <div className="w-20 h-20 bg-primary/5 rounded-[2rem] flex items-center justify-center">
                                                <Smartphone className="w-10 h-10 text-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-slate-900 italic">Security Check</h3>
                                                <p className="text-xs text-slate-500 font-medium px-8">LinkedIn noticed a login from our Cloud Node. Enter the 6-digit code sent to your email.</p>
                                            </div>
                                        </div>
                                        
                                        <input 
                                            type="text" 
                                            value={twoFACode} 
                                            onChange={(e) => setTwoFACode(e.target.value)}
                                            maxLength={6}
                                            placeholder="000000"
                                            className="w-full py-6 bg-slate-50 border-none rounded-[2rem] text-center text-4xl font-black tracking-[0.5em] focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            required
                                        />

                                        {error && (
                                            <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100">
                                                <AlertCircle className="w-4 h-4" />
                                                <span>{error}</span>
                                            </div>
                                        )}

                                        <button 
                                            type="submit" 
                                            disabled={loading}
                                            className="w-full h-14 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Verify Sync</span>}
                                        </button>
                                    </motion.form>
                                )}

                                {step === 'SUCCESS' && (
                                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center space-y-6">
                                        <div className="relative inline-block">
                                            <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                                                <CheckCircle2 className="w-12 h-12 text-white" />
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-emerald-50">
                                                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-3xl font-black text-slate-900 italic tracking-tight uppercase">Signals Locked</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Automation engine is now operational.</p>
                                        </div>
                                        <button 
                                            onClick={() => setShowModal(false)}
                                            className="w-full h-14 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all"
                                        >
                                            Enter Dashboard
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative">
            <button
                onClick={() => {
                    if (status?.connected) {
                        setShowModal(true);
                        setStep('SUCCESS');
                    } else {
                        handleOneClickSync();
                    }
                }}
                className={status?.connected
                    ? "flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 transition-all hover:bg-emerald-100 shadow-sm"
                    : "flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full border border-slate-700 transition-all hover:bg-black hover:scale-105 shadow-xl animate-pulse"
                }
            >
                {status?.connected ? (
                    <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.1em]">Signal Active</span>
                    </>
                ) : (
                    <>
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.1em]">Sync LinkedIn Now</span>
                    </>
                )}
            </button>

            {mounted && createPortal(modalContent, document.body)}
        </div>
    );
}
