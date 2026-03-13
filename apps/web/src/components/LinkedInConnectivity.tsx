'use client';

import { useState, useEffect } from 'react';
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

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isPolling && setShowModal(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                        />
                        
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
                        >
                            {isPolling ? (
                                <div className="p-12 flex flex-col items-center text-center space-y-8">
                                    <div className="relative">
                                        <div className="w-32 h-32 rounded-full bg-primary/5 flex items-center justify-center">
                                            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                            <Linkedin className="w-16 h-16 text-primary" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                                            <Globe className="w-6 h-6 text-primary animate-pulse" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <h2 className="text-3xl font-black text-slate-900 leading-tight">Syncing LinkedIn...</h2>
                                        <p className="text-slate-500 font-medium">Please login in the browser window that just opened. We'll automatically detect when you're done.</p>
                                    </div>

                                    <div className="w-full bg-slate-50 p-6 rounded-3xl space-y-4">
                                        <div className="flex items-center space-x-3 text-left">
                                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600">Secure browser launched</span>
                                        </div>
                                        <div className="flex items-center space-x-3 text-left opacity-50">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                                                <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-400">Waiting for session token...</span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => setIsPolling(false)}
                                        className="text-slate-400 font-bold hover:text-red-500 transition-colors"
                                    >
                                        Cancel Sync
                                    </button>
                                </div>
                            ) : (
                                <div className="p-10 space-y-10">
                                    <div className="flex items-center justify-between">
                                        <div className="w-20 h-20 bg-[#0077b5] rounded-3xl flex items-center justify-center shadow-xl shadow-[#0077b5]/20 rotate-3 transition-transform hover:rotate-0">
                                            <Linkedin className="w-12 h-12 text-white" />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Secure Connection</span>
                                            <h2 className="text-4xl font-black text-slate-900 -mt-1">Connect</h2>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="group p-6 bg-slate-50 rounded-[32px] border-2 border-transparent hover:border-primary/20 hover:bg-white hover:shadow-xl transition-all cursor-pointer" onClick={handleLaunchSync}>
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                                <Zap className="w-6 h-6" />
                                            </div>
                                            <h3 className="font-black text-slate-900 leading-tight">Live Sync</h3>
                                            <p className="text-xs text-slate-500 mt-2 font-bold opacity-70 uppercase tracking-wider">Fastest Way</p>
                                        </div>
                                        
                                        <div className="group p-6 bg-slate-50 rounded-[32px] border-2 border-transparent hover:border-accent/20 hover:bg-white hover:shadow-xl transition-all cursor-not-allowed opacity-50">
                                            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                                                <Chrome className="w-6 h-6" />
                                            </div>
                                            <h3 className="font-black text-slate-900 leading-tight">Extension</h3>
                                            <p className="text-xs text-slate-500 mt-2 font-bold uppercase">Coming Soon</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                            <ShieldCheck className="w-6 h-6 text-primary" />
                                            <p className="text-xs font-bold text-slate-600">
                                                We use a persistent cloud browser to keep your account safe and reduce detection.
                                            </p>
                                        </div>
                                        
                                        <button 
                                            disabled={launching}
                                            onClick={handleLaunchSync}
                                            className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-xl shadow-slate-900/10 hover:shadow-slate-900/30 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 group"
                                        >
                                            {launching ? (
                                                <RefreshCcw className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <>
                                                    <span>Start Sync Session</span>
                                                    <ExternalLink className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                        
                                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            No password required • Encrypted session
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
