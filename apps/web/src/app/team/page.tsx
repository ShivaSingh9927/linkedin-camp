"use client";

import { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Shield,
    User,
    Trash2,
    ExternalLink,
    PlusCircle,
    CheckCircle2,
    Crown,
    Zap
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface TeamMember {
    id: string;
    role: 'ADMIN' | 'MEMBER';
    joinedAt: string;
    user: {
        id: string;
        email: string;
    };
    stats?: {
        activeCampaigns: number;
        totalLeads: number;
        invitesToday?: number;
        messagesToday?: number;
        totalReplies?: number;
        hasProxy?: boolean;
        dailyInviteLimit?: number;
    };
}

interface TeamInvite {
    id: string;
    email: string;
    role: string;
    status: string;
    token: string;
    createdAt: string;
}

interface Team {
    id: string;
    name: string;
    ownerId: string;
    members: TeamMember[];
    invites: TeamInvite[];
}

export default function TeamPage() {
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState<{ hasTeam: boolean; team?: Team; role?: string } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
    const [inviteMeta, setInviteMeta] = useState<{ inviteLink?: string; token?: string } | null>(null);

    // Fetch team data
    const fetchTeam = async () => {
        try {
            setLoading(true);
            const res = await api.get('/team');
            setTeamData(res.data);
        } catch (err) {
            console.error('Failed to fetch team:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, []);

    // Create a new team
    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsCreating(true);
            const res = await api.post('/team/create', { name: newTeamName });
            setTeamData(res.data);
            setNewTeamName("");
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to create team.");
        } finally {
            setIsCreating(false);
        }
    };

    // Invite a member
    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/team/invite', {
                teamId: teamData?.team?.id,
                email: inviteEmail,
                role: inviteRole
            });
            setInviteMeta({ inviteLink: res.data.inviteLink, token: res.data.token });
            fetchTeam(); // Refresh invites list
            setInviteEmail("");
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to invite member.");
        }
    };

    // Remove member
    const handleRemoveMember = async (targetUserId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            await api.delete(`/team/${teamData?.team?.id}/members/${targetUserId}`);
            fetchTeam();
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to remove member.");
        }
    };

    // --- Loading State ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // --- Empty State (No Team) ---
    if (!teamData?.hasTeam) {
        return (
            <div className="max-w-xl mx-auto py-12 px-6">
                <div className="bg-white rounded-[40px] shadow-2xl border p-10 text-center space-y-8 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                        <Users className="w-10 h-10 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tight italic">Create a Crew</h1>
                        <p className="text-slate-500 mt-2 font-medium">Bring your colleagues together to boost your LinkedIn prospecting.</p>
                    </div>

                    <form onSubmit={handleCreateTeam} className="space-y-4">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Your Crew Name (e.g. Sales Rocket)"
                                className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-lg transition-all"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            disabled={isCreating}
                            className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase text-sm tracking-widest hover:bg-black transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center justify-center space-x-2"
                        >
                            <span>{isCreating ? "Creating Crew..." : "Set Up Crew →"}</span>
                        </button>
                    </form>

                    <div className="pt-6 border-t">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Or check your email for an invitation from your admin
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // --- Team Dashboard ---
    const team = teamData.team!;
    const myRole = teamData.role;

    const totalInvitesToday = team.members.reduce((acc, m) => acc + (m.stats?.invitesToday || 0), 0);
    const totalDailyLimit = team.members.reduce((acc, m) => acc + (m.stats?.dailyInviteLimit || 30), 0);
    const totalReplies = team.members.reduce((acc, m) => acc + (m.stats?.totalReplies || 0), 0);

    return (
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12 p-4 sm:p-8 lg:p-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-10">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{team.name}</h1>
                        <div className="flex items-center space-x-2 px-3 sm:px-4 py-1 sm:py-1.5 bg-primary text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-primary/20">
                            <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>{myRole}</span>
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm sm:text-base font-semibold max-w-2xl leading-relaxed lg:opacity-70 uppercase tracking-wide">Workspace for consolidated prospecting and workforce orchestration.</p>
                </div>

                {myRole === 'ADMIN' && (
                    <button
                        onClick={() => { setIsInviting(!isInviting); setInviteMeta(null); }}
                        disabled={team.members.length + (team.invites?.length || 0) >= 10}
                        className={cn(
                            "flex items-center justify-center space-x-3 border-2 px-6 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black uppercase text-[10px] sm:text-xs tracking-[0.15em] transition-all shadow-premium active:scale-95 group",
                            team.members.length + (team.invites?.length || 0) >= 10 
                                ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' 
                                : 'bg-background text-foreground border-foreground hover:bg-foreground hover:text-background'
                        )}
                    >
                        <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                        <span>Invite Operator</span>
                    </button>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Total Members', value: team.members?.length || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Network Invites', value: `${totalInvitesToday}/${totalDailyLimit}`, icon: ExternalLink, color: 'text-primary', bg: 'bg-primary/5' },
                    { label: 'Total Leads Won', value: totalReplies, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Cloud Status', value: 'Protected', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-premium flex items-center space-x-5 hover:border-primary/20 transition-all group">
                        <div className={cn("p-4 sm:p-5 rounded-2xl transition-all group-hover:scale-110", stat.bg, stat.color)}>
                            <stat.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                {/* Invite Panel Sidebar */}
                <AnimatePresence>
                    {isInviting && myRole === 'ADMIN' && (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="lg:col-span-4 space-y-6"
                        >
                            <div className="bg-white rounded-[3rem] border border-primary/20 shadow-premium p-8 sm:p-10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-8 sm:mb-10">
                                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight italic">New Key</h2>
                                        <button onClick={() => setIsInviting(false)} className="bg-slate-100 p-2 sm:p-3 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                                            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 rotate-45" />
                                        </button>
                                    </div>

                                    <form onSubmit={handleInvite} className="space-y-6 sm:space-y-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Identification Email</label>
                                            <input
                                                type="email"
                                                className="w-full px-6 py-4 sm:py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm sm:text-base"
                                                placeholder="operator@nexus.com"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Access Level</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setInviteRole('MEMBER')}
                                                    className={cn(
                                                        "py-4 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-widest rounded-2xl border transition-all",
                                                        inviteRole === 'MEMBER' 
                                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                                            : 'bg-background text-slate-500 border-slate-200 hover:border-primary/40'
                                                    )}
                                                >
                                                    Agent
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setInviteRole('ADMIN')}
                                                    className={cn(
                                                        "py-4 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-widest rounded-2xl border transition-all",
                                                        inviteRole === 'ADMIN' 
                                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                                            : 'bg-background text-slate-500 border-slate-200 hover:border-primary/40'
                                                    )}
                                                >
                                                    Admin
                                                </button>
                                            </div>
                                        </div>
                                        <button className="w-full bg-slate-900 text-white py-5 sm:py-6 rounded-2xl sm:rounded-3xl font-black uppercase text-[10px] sm:text-xs tracking-[0.25em] hover:bg-black transition-all shadow-xl active:scale-95">
                                            Generate Access Key
                                        </button>
                                    </form>

                                    {inviteMeta && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-8 sm:mt-10 p-6 sm:p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100"
                                        >
                                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-4 flex items-center">
                                                <Shield className="w-4 h-4 mr-2" />
                                                Cloud Link Active
                                            </p>
                                            <div 
                                                className="bg-white p-4 rounded-2xl border border-emerald-100 flex items-center justify-between cursor-pointer group"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/team/join?token=${inviteMeta.token}`);
                                                    alert("Link Encrypted & Copied!");
                                                }}
                                            >
                                                <p className="text-[9px] text-emerald-600 truncate font-mono font-bold pr-4">
                                                    {window.location.origin.replace(/(^\w+:|^)\/\//, '')}/...{inviteMeta.token?.slice(-8)}
                                                </p>
                                                <PlusCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 group-hover:text-emerald-600 transition-all flex-shrink-0" />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Workforce Display */}
                <div className={cn(
                    "bg-white rounded-[3rem] sm:rounded-[4rem] border border-slate-100 shadow-premium overflow-hidden transition-all duration-500",
                    isInviting && myRole === 'ADMIN' ? 'lg:col-span-8' : 'lg:col-span-12'
                )}>
                    <div className="px-8 sm:px-12 py-8 sm:py-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6 bg-slate-50/20">
                        <div className="flex items-center space-x-4">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight italic">Division Units</h2>
                            <span className="bg-primary/10 text-primary px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase">
                                {team.members.length}/10 Operational
                            </span>
                        </div>
                    </div>

                    <div className="p-4 sm:p-8">
                        {/* Mobile List View */}
                        <div className="grid grid-cols-1 gap-4 lg:hidden">
                            {team.members.map((m) => (
                                <div key={m.id} className="p-6 rounded-[2rem] border border-slate-100 bg-white hover:border-primary/20 transition-all space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black">
                                                {m.user.email[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 truncate">{m.user.email}</p>
                                                <p className="text-[9px] font-bold text-primary uppercase tracking-[0.15em]">{m.role}</p>
                                            </div>
                                        </div>
                                        {myRole === 'ADMIN' && m.user.id !== team.ownerId && (
                                            <button onClick={() => handleRemoveMember(m.user.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-50">
                                        <div className="text-center">
                                            <p className="text-xs font-black text-slate-900">{m.stats?.invitesToday || 0}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Invites</p>
                                        </div>
                                        <div className="text-center border-x border-slate-100">
                                            <p className="text-xs font-black text-slate-900">{m.stats?.messagesToday || 0}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Msg</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-black text-emerald-600">{m.stats?.totalReplies || 0}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Leads</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-50">
                                        <th className="px-4 py-8">Operator</th>
                                        <th className="px-4 py-8">Status</th>
                                        <th className="px-4 py-8 text-center">Load</th>
                                        <th className="px-4 py-8 text-right">Shield</th>
                                        <th className="px-4 py-8 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {team.members.map((m) => (
                                        <tr key={m.id} className="hover:bg-slate-50/50 transition-all group">
                                            <td className="px-4 py-8">
                                                <div className="flex items-center space-x-5">
                                                    <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white font-black text-lg">
                                                        {m.user.email[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-black text-slate-900 tracking-tight">{m.user.email}</p>
                                                        <p className="text-[10px] font-black uppercase text-slate-400">{m.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-8">
                                                <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span>Active</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-8 text-center">
                                                <p className="text-xl font-black text-slate-900">{m.stats?.totalReplies || 0}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Leads</p>
                                            </td>
                                            <td className="px-4 py-8 text-right">
                                                <Shield className={cn("w-5 h-5 ml-auto", m.stats?.hasProxy ? "text-primary" : "text-slate-200")} />
                                            </td>
                                            <td className="px-4 py-8 text-right">
                                                {myRole === 'ADMIN' && m.user.id !== team.ownerId && (
                                                    <button onClick={() => handleRemoveMember(m.user.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
