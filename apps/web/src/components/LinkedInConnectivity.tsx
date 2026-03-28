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

type LinkStep = 'CHOICE' | 'CREDENTIALS' | 'PROGRESS' | '2FA' | 'SUCCESS' | 'DEBUGGER';

export default function LinkedInConnectivity() {
    const [status, setStatus] = useState<{
        userId?: string;
        connected: boolean;
        cookie?: string;
        persistent?: boolean;
        persistentPath?: string;
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
                setError(data.error || 'Identity verification failed.');
                setStep('CREDENTIALS');
            }
        } catch (err) {
            setError('Connection error.');
            setStep('CREDENTIALS');
        } finally {
            setLoading(false);
        }
    };

    const handleOneClickSync = () => {
        setStep('PROGRESS');
        setLoading(true);
        setProgressMsg('Waiting for extension to capture session...');
        
        // Ensure the user is actually on LinkedIn or at least has it open
        window.open('https://www.linkedin.com/feed/', '_blank');
        
        window.postMessage({ type: 'LINKEDIN_CAMP_FORCE_SYNC' }, '*');
        toast.info('Opening secure sync window...', {
            description: 'Please make sure you are logged into LinkedIn in this browser.'
        });
        
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            const statusData = await fetchStatus();
            
            if (statusData?.persistentPath || statusData?.connected) {
                setStep('SUCCESS');
                setLoading(false);
                clearInterval(interval);
                toast.success('Session synchronized & verified!');
            } else if (attempts > 30) {
                 setProgressMsg('Still waiting... Please ensure LinkedIn is open and you are logged in.');
            }
        }, 3000);
        
        setTimeout(() => {
            clearInterval(interval);
            if (step !== 'SUCCESS') {
                setLoading(false);
                setStep('CHOICE');
                setError('Sync timed out. Please try again.');
            }
        }, 120000);
    };

    const handlePhase1Sync = () => {
        setStep('DEBUGGER');
        setLoading(false);
        toast.info('Launching Cloud Debugger...', {
            description: 'You can now log in directly on our secure server.'
        });
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setStep('PROGRESS');
        setProgressMsg('Verifying code...');

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
                setError(data.error || 'Invalid code.');
                setStep('2FA');
            }
        } catch (err) {
            setError('Sync error.');
            setStep('2FA');
        } finally {
            setLoading(false);
        }
    };

    const modalContent = (
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-[#0077b5] rounded-xl flex items-center justify-center shadow-lg">
                                        <Linkedin className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 leading-none uppercase italic">Cloud Link</h2>
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {step === 'CHOICE' && (
                                    <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                        <div className="space-y-2 text-center pb-4">
                                            <h3 className="text-2xl font-black text-slate-900 italic">SECURE SYNC</h3>
                                            <p className="text-sm text-slate-500 font-medium">Capture your active LinkedIn session via extension.</p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <button 
                                                onClick={handleOneClickSync}
                                                className="group text-left p-8 bg-slate-900 rounded-[2.5rem] hover:bg-black transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="w-14 h-14 rounded-2xl bg-[#0077b5] flex items-center justify-center text-white shadow-lg">
                                                        <Chrome className="w-8 h-8" />
                                                    </div>
                                                    <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                                        <span className="text-[10px] text-emerald-500 font-black uppercase">Instant</span>
                                                    </div>
                                                </div>
                                                <h4 className="font-black text-white uppercase text-lg italic">Start Sync</h4>
                                                <p className="text-xs text-slate-400 font-bold mt-1 uppercase">Recommended Flow</p>
                                            </button>
                                            
                                            {error && (
                                                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100 italic">
                                                    {error}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {step === 'PROGRESS' && (
                                    <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center space-y-8">
                                        <div className="relative w-24 h-24 mx-auto">
                                            <div className="absolute inset-0 border-4 border-[#0077b5]/20 rounded-full" />
                                            <motion.div 
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                className="absolute inset-0 border-4 border-t-[#0077b5] rounded-full"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <RefreshCcw className="w-8 h-8 text-[#0077b5] animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="text-2xl font-black text-slate-900 italic uppercase">Syncing...</h3>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                                                {progressMsg}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 'SUCCESS' && (
                                    <motion.div key="success" className="py-10 text-center space-y-6">
                                        <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl mx-auto">
                                            <CheckCircle2 className="w-12 h-12 text-white" />
                                        </div>
                                        <h3 className="text-3xl font-black text-slate-900 italic uppercase">Signals Locked</h3>
                                        <div className="flex flex-col gap-3">
                                            <button 
                                                onClick={() => setShowModal(false)} 
                                                className="w-full h-14 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase"
                                            >
                                                Enter Dashboard
                                            </button>
                                            <button 
                                                onClick={() => setStep('CHOICE')} 
                                                className="w-full h-10 text-slate-400 font-bold text-[10px] uppercase hover:text-slate-600 transition-colors"
                                            >
                                                Re-Sync or Manage Connection
                                            </button>
                                        </div>
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
                    setShowModal(true);
                    setStep('CHOICE');
                }}
                className={status?.connected
                    ? "flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100"
                    : "flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full animate-pulse"
                }
            >
                {status?.connected ? (
                    <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-black uppercase">Signal Active</span></>
                ) : (
                    <><Zap className="w-4 h-4 text-emerald-400" /><span className="text-[10px] font-black uppercase">Sync Now</span></>
                )}
            </button>
            {mounted && createPortal(modalContent, document.body)}
        </div>
    );
}
