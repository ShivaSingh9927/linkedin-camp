"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, ShieldCheck, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

function JoinTeamContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [inviteInfo, setInviteInfo] = useState<{ teamName: string; role: string; email: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("No invitation token provided. Please check your link.");
            setLoading(false);
            return;
        }

        const fetchInvite = async () => {
            try {
                const res = await api.get(`/team/invite/${token}`);
                setInviteInfo(res.data);
            } catch (err: any) {
                setError(err.response?.data?.error || "Invalid or expired invitation link.");
            } finally {
                setLoading(false);
            }
        };

        fetchInvite();
    }, [token]);

    const handleJoin = async () => {
        if (!token) return;
        try {
            setJoining(true);
            await api.post('/team/join', { token });
            setSuccess(true);
            setTimeout(() => {
                router.push('/team');
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to join team.");
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Verifying Access Token...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-md mx-auto pt-20 px-6 animate-in zoom-in duration-500">
                <div className="bg-white rounded-[40px] shadow-2xl border border-red-100 p-10 text-center space-y-6">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Access Denied</h1>
                        <p className="text-slate-500 mt-3 font-medium">{error}</p>
                    </div>
                    <Link href="/team" className="block w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-200 transition-all">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="max-w-md mx-auto pt-20 px-6 animate-in zoom-in duration-500">
                <div className="bg-white rounded-[40px] shadow-2xl border border-emerald-100 p-10 text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-10 h-10 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Access Granted</h1>
                        <p className="text-slate-500 mt-3 font-medium">You have successfully joined <span className="font-bold text-slate-900">{inviteInfo?.teamName}</span>.</p>
                        <p className="text-sm text-emerald-600 font-bold mt-2 animate-pulse">Redirecting to workspace...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto pt-20 px-6 animate-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-[40px] shadow-2xl border p-12 overflow-hidden relative">
                {/* Decorative background curve */}
                <div className="absolute top-0 left-0 w-full h-32 bg-indigo-600/5" />

                <div className="relative text-center space-y-8">
                    <div className="w-24 h-24 bg-indigo-600 rounded-[30px] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-600/30 transform -rotate-6">
                        <Users className="w-12 h-12 text-white transform rotate-6" />
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">Secure Invitation</h4>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Join Workspace</h1>
                        <p className="text-slate-500 font-medium px-4">
                            You've been invited to combine forces and scale your prospecting efforts as a unified team.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 text-left space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Organization</p>
                                <p className="font-black text-slate-900 text-lg truncate">{inviteInfo?.teamName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Role</p>
                                <div className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black tracking-widest">
                                    {inviteInfo?.role}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase text-sm tracking-widest hover:bg-black transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center justify-center space-x-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>{joining ? "Accepting..." : "Accept Invitation"}</span>
                        {!joining && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>

                    <p className="text-xs font-bold text-slate-400">
                        Joining will link your account (<strong>{inviteInfo?.email}</strong>) to this team workspace.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function JoinTeamPage() {
    return (
        <div className="min-h-screen bg-slate-50 relative pb-20">
            {/* Simple top bar for standalone feeling */}
            <div className="h-20 border-b bg-white flex items-center px-10">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Users className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-black text-slate-900 uppercase tracking-widest text-sm italic">LinkedIn Camp</span>
                </div>
            </div>

            <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-600" /></div>}>
                <JoinTeamContent />
            </Suspense>
        </div>
    );
}
