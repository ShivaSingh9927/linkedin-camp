'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Linkedin,
    CheckCircle2,
    RefreshCcw,
    ShieldCheck,
    AlertCircle,
    Copy,
    Key,
    ExternalLink,
    Chrome,
    Zap,
    Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function LinkedInConnectivity() {
    const [status, setStatus] = useState<{
        connected: boolean;
        cookie?: string;
        persistent?: boolean;
    } | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [launching, setLaunching] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/linkedin-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
            return data;
        } catch (error) {
            return null;
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    // Polling mechanism
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPolling) {
            interval = setInterval(async () => {
                const data = await fetchStatus();
                if (data?.connected) {
                    setIsPolling(false);
                    setShowModal(false);
                    toast.success('LinkedIn connected successfully!');
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isPolling]);

    const handleLaunchSync = async () => {
        setLaunching(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/start-login`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setLaunching(false);
                setIsPolling(true);
                toast.info('Browser window opened. Please login to LinkedIn.');
            } else {
                setLaunching(false);
                toast.error('Failed to launch browser. Please try again.');
            }
        } catch (error) {
            setLaunching(false);
            toast.error('Connection error.');
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
                        onClick={() => setShowModal(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-md rounded-[32px] shadow-2xl relative z-10 overflow-hidden border border-border/50 flex flex-col max-h-[95vh]"
                    >
                        <div className="overflow-y-auto scrollbar-hide py-4 px-5 sm:px-8">
                            {isPolling ? (
                                <div className="flex flex-col items-center text-center space-y-4 py-2">
                                    <div className="relative">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/5 flex items-center justify-center">
                                            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                            <Linkedin className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                                            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse" />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Syncing...</h2>
                                        <p className="text-[11px] sm:text-xs text-slate-500 font-bold leading-relaxed px-4">Login in the browser window. We&apos;ll automatically detect completion.</p>
                                    </div>

                                    <div className="w-full bg-slate-50 p-4 rounded-2xl space-y-2">
                                        <div className="flex items-center space-x-2 text-left">
                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Browser launched</span>
                                        </div>
                                        <div className="flex items-center space-x-2 text-left opacity-50">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                                                <div className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Waiting for session...</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setIsPolling(false)}
                                        className="text-slate-400 font-black hover:text-red-500 transition-colors text-[10px] uppercase tracking-widest pt-2"
                                    >
                                        Cancel Sync
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-5 sm:space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#0077b5] rounded-2xl flex items-center justify-center shadow-lg shadow-[#0077b5]/20">
                                            <Linkedin className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">LinkedIn</span>
                                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 -mt-1 tracking-tight">Connect</h2>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            className="group p-3 sm:p-4 bg-slate-50 rounded-[20px] sm:rounded-[24px] border-2 border-transparent hover:border-primary/20 hover:bg-white hover:shadow-xl transition-all cursor-pointer"
                                            onClick={handleLaunchSync}
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                                                <Zap className="w-4 h-4" />
                                            </div>
                                            <h3 className="font-black text-slate-900 leading-tight text-[11px] sm:text-xs">Live Sync</h3>
                                            <p className="text-[8px] sm:text-[9px] text-slate-500 mt-1 font-bold opacity-70 uppercase tracking-wider">Fastest</p>
                                        </div>

                                        <div className="group p-3 sm:p-4 bg-slate-50 rounded-[20px] sm:rounded-[24px] border-2 border-transparent opacity-50 cursor-not-allowed">
                                            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-2">
                                                <Chrome className="w-4 h-4" />
                                            </div>
                                            <h3 className="font-black text-slate-900 leading-tight text-[11px] sm:text-xs">Extension</h3>
                                            <p className="text-[8px] sm:text-[9px] text-slate-500 mt-1 font-bold uppercase">Soon</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2.5 p-3 bg-primary/5 rounded-2xl border border-primary/10 text-left">
                                            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
                                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-600 leading-tight">
                                                Persistent cloud browser keeps your account safe.
                                            </p>
                                        </div>

                                        <button
                                            disabled={launching}
                                            onClick={handleLaunchSync}
                                            className="w-full h-12 sm:h-14 bg-slate-900 text-white rounded-2xl sm:rounded-[24px] font-black text-sm sm:text-base shadow-xl shadow-slate-900/10 hover:shadow-slate-900/30 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 group"
                                        >
                                            {launching ? (
                                                <RefreshCcw className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <span>Start Sync Session</span>
                                                    <ExternalLink className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                </>
                                            )}
                                        </button>

                                        <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                                            No password required • Encrypted
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative">
            <button
                onClick={() => setShowModal(true)}
                className={status?.connected
                    ? "flex items-center space-x-2 px-3 py-1.5 bg-accent/10 text-accent rounded-full border border-accent/20 transition-all hover:bg-accent/20"
                    : "flex items-center space-x-2 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200 transition-all hover:bg-slate-200"
                }
            >
                {status?.connected ? (
                    <>
                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider">Linked</span>
                    </>
                ) : (
                    <>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sync LinkedIn</span>
                    </>
                )}
            </button>

            {mounted && createPortal(modalContent, document.body)}
        </div>
    );
}
