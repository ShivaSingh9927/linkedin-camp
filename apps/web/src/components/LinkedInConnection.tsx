'use client';

import { useState, useEffect } from 'react';
import { 
    Linkedin, 
    CheckCircle2, 
    XCircle, 
    RefreshCcw, 
    ShieldCheck, 
    ExternalLink,
    AlertCircle,
    Copy,
    Key
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function LinkedInConnection() {
    const [status, setStatus] = useState<{
        connected: boolean;
        cookie?: string;
        persistent?: boolean;
        profile?: any;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [cookieInput, setCookieInput] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/linkedin-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error('Failed to fetch status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleCookieSync = async () => {
        if (!cookieInput.trim()) return;
        setIsSyncing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/extension-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ linkedinCookie: cookieInput })
            });

            if (res.ok) {
                toast.success('LinkedIn connected successfully!');
                setCookieInput('');
                fetchStatus();
            } else {
                toast.error('Failed to sync. Please check your cookie.');
            }
        } catch (error) {
            toast.error('An error occurred.');
        } finally {
            setIsSyncing(false);
        }
    };

    if (loading) return (
        <div className="h-64 flex items-center justify-center">
            <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <div className="p-8 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-[#0077b5] rounded-2xl flex items-center justify-center shadow-lg shadow-[#0077b5]/20">
                                <Linkedin className="w-10 h-10 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">LinkedIn Connectivity</h3>
                                <div className="flex items-center mt-1 space-x-2">
                                    {status?.connected ? (
                                        <span className="flex items-center text-xs font-bold text-accent px-2 py-0.5 bg-accent/10 rounded-full">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            CONNECTED
                                        </span>
                                    ) : (
                                        <span className="flex items-center text-xs font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                                            <XCircle className="w-3 h-3 mr-1" />
                                            NOT CONNECTED
                                        </span>
                                    )}
                                    {status?.persistent && (
                                        <span className="flex items-center text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                                            <ShieldCheck className="w-3 h-3 mr-1" />
                                            CLOUD READY
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={fetchStatus}
                            className="p-3 text-slate-400 hover:text-primary transition-all hover:bg-white rounded-2xl border border-transparent hover:border-slate-100 hover:shadow-sm"
                        >
                            <RefreshCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {!status?.connected ? (
                        <div className="space-y-6">
                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start space-x-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-bold">Sync required</p>
                                    <p className="mt-0.5 opacity-80">You need to connect your LinkedIn account to start launching campaigns and syncing your inbox.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-700">Connect via Cookie (li_at)</label>
                                    <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                        How to find this? <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex space-x-3">
                                    <div className="relative flex-1">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="password"
                                            value={cookieInput}
                                            onChange={(e) => setCookieInput(e.target.value)}
                                            placeholder="Paste your li_at cookie here..."
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleCookieSync}
                                        disabled={isSyncing || !cookieInput}
                                        className="bg-primary text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95"
                                    >
                                        Connect
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                                        <Copy className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Session</p>
                                        <p className="text-sm font-bold text-slate-800">
                                            {status.cookie ? `${status.cookie.substring(0, 15)}...` : 'Persistent Session'}
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <button className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all">
                                        Disconnect Account
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                                        <ShieldCheck className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Global Status</p>
                                        <p className="text-sm font-bold text-slate-800">
                                            Account is safe and synced
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <button className="text-xs font-bold text-primary hover:bg-white px-3 py-1.5 rounded-lg transition-all shadow-sm">
                                        Run Safety Check
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-3xl border shadow-sm p-8 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-50 overflow-hidden shadow-sm">
                        <img 
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
                            alt="Extension" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">Chrome Extension</h4>
                        <p className="text-sm text-slate-500">Enable one-click sync and real-time message notifications.</p>
                    </div>
                </div>
                <button className="flex items-center space-x-2 px-6 py-2.5 rounded-xl border-2 border-slate-100 font-bold text-sm text-slate-600 hover:border-primary hover:text-primary transition-all">
                    <span>Install Extension</span>
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
