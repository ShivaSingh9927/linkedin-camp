"use client";

import { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Shield,
    User,
    Trash2,
    ExternalLink,
    Crown,
    Settings,
    PlusCircle
} from 'lucide-react';
import api from '@/lib/api';

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

    return (
        <div className="max-w-7xl mx-auto space-y-10 p-8 pt-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center space-x-4">
                        <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter italic">{team.name}</h1>
                        <div className="flex items-center space-x-2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-indigo-200">
                            <Shield className="w-3 h-3" />
                            <span>{myRole}</span>
                        </div>
                    </div>
                    <p className="text-slate-500 text-base mt-2 font-semibold">Workspace for consolidated prospecting and member management.</p>
                </div>

                {myRole === 'ADMIN' && (
                    <button
                        onClick={() => { setIsInviting(!isInviting); setInviteMeta(null); }}
                        disabled={team.members.length + (team.invites?.length || 0) >= 10}
                        className={`flex items-center space-x-3 border-2 px-8 py-4 rounded-3xl font-black uppercase text-xs tracking-[0.15em] transition-all shadow-xl active:scale-95 group ${team.members.length + (team.invites?.length || 0) >= 10 ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-900 hover:text-white'}`}
                        title={team.members.length + (team.invites?.length || 0) >= 10 ? 'Capacity Reached' : 'Invite Member'}
                    >
                        <UserPlus className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span>Invite Operator</span>
                    </button>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: 'Total Members', value: team.members?.length || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Active Invites', value: team.invites?.length || 0, icon: ExternalLink, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Cloud Status', value: 'Protected', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white p-7 rounded-[35px] border-2 border-slate-50 shadow-sm flex items-center space-x-5 hover:border-slate-200 transition-colors">
                        <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-inner`}>
                            <stat.icon className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                {/* Invite Panel (Conditional) */}
                {isInviting && myRole === 'ADMIN' && (
                    <div className="lg:col-span-4 bg-white rounded-[40px] border-4 border-indigo-50 shadow-2xl p-10 h-fit animate-in slide-in-from-left-8 duration-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />

                        <div className="relative">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">New Invitation</h2>
                                <button onClick={() => setIsInviting(false)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                    <PlusCircle className="w-5 h-5 rotate-45" />
                                </button>
                            </div>

                            <form onSubmit={handleInvite} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">Member Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-sm transition-all"
                                        placeholder="colleague@company.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">Select Role</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setInviteRole('MEMBER')}
                                            className={`py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl border-2 transition-all ${inviteRole === 'MEMBER' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                                        >
                                            Member
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setInviteRole('ADMIN')}
                                            className={`py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl border-2 transition-all ${inviteRole === 'ADMIN' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                                        >
                                            Admin
                                        </button>
                                    </div>
                                </div>
                                <button
                                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-black transition-all shadow-xl active:scale-95"
                                >
                                    Send Access Key
                                </button>
                            </form>

                            {inviteMeta && (
                                <div className="mt-10 p-6 bg-emerald-50 rounded-[28px] border-2 border-emerald-100 animate-in bounce-in duration-500">
                                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.15em] mb-3 flex items-center">
                                        <Shield className="w-4 h-4 mr-2" />
                                        Access Token Ready
                                    </p>
                                    <div className="bg-white p-3 rounded-xl border-2 border-emerald-100 relative group cursor-pointer" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/team/join?token=${inviteMeta.token}`); alert("Link copied!"); }}>
                                        <p className="text-[10px] text-emerald-600 break-all font-mono leading-relaxed">
                                            {window.location.origin}/team/join?token={inviteMeta.token}
                                        </p>
                                        <div className="absolute inset-0 bg-emerald-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                            <p className="text-[10px] font-black uppercase">Copy URL</p>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-emerald-500 mt-3 font-bold italic leading-tight">
                                        Share this temporary link directly with your teammate to grant access.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Members Table */}
                <div className={`${isInviting ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white rounded-[40px] border-2 border-slate-50 shadow-xl overflow-hidden animate-in slide-in-from-right-8 duration-500`}>
                    <div className="px-10 py-8 border-b flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center space-x-3">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Workforce</h2>
                            <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest">
                                {team.members.length} / 10 SEATS
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/70 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">
                                    <th className="px-10 py-6">Operator</th>
                                    <th className="px-10 py-6">Authority</th>
                                    <th className="px-10 py-6 text-center">Performance</th>
                                    <th className="px-10 py-6 text-right">Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {team.members.map((m) => (
                                    <tr key={m.id} className="hover:bg-indigo-50/20 transition-all group">
                                        <td className="px-10 py-7">
                                            <div className="flex items-center space-x-5">
                                                <div className="w-14 h-14 bg-slate-900 rounded-[22px] flex items-center justify-center text-white font-black text-lg shadow-xl group-hover:bg-indigo-600 transition-all group-hover:rotate-12">
                                                    {m.user.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-slate-900 tracking-tight">{m.user.email}</p>
                                                    <div className="flex items-center mt-1">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-sm shadow-emerald-200" />
                                                        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Secured & Active</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-7">
                                            {m.role === 'ADMIN' ? (
                                                <div className="inline-flex items-center bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl border border-amber-100 space-x-2">
                                                    <Crown className="w-4 h-4" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Administrator</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center bg-slate-50 text-slate-600 px-4 py-2 rounded-2xl border border-slate-100 space-x-2">
                                                    <User className="w-4 h-4" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Agent</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-10 py-7 text-center">
                                            <div className="flex items-center justify-center space-x-4">
                                                <div className="text-center">
                                                    <p className="text-xl font-black text-slate-900">{m.stats?.activeCampaigns || 0}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Cmp.</p>
                                                </div>
                                                <div className="w-px h-8 bg-slate-100"></div>
                                                <div className="text-center">
                                                    <p className="text-xl font-black text-slate-900">{m.stats?.totalLeads || 0}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Leads Extracted</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-7 text-right">
                                            {myRole === 'ADMIN' && m.user.id !== team.ownerId ? (
                                                <button
                                                    onClick={() => handleRemoveMember(m.user.id)}
                                                    className="p-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-5 h-5 transition-transform hover:rotate-12" />
                                                </button>
                                            ) : (
                                                <div className="bg-slate-50 text-slate-400 p-3 rounded-2xl inline-block">
                                                    <Shield className="w-5 h-5 opacity-30" />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {/* Active Invites */}
                                {(team.invites || []).filter(i => i.status === 'PENDING').map((i) => (
                                    <tr key={i.id} className="bg-amber-50/10 border-l-4 border-l-amber-400 opacity-80">
                                        <td className="px-10 py-7">
                                            <div className="flex items-center space-x-5">
                                                <div className="w-14 h-14 bg-slate-100 border-2 border-dashed border-slate-300 rounded-[22px] flex items-center justify-center text-slate-300 font-black">
                                                    <UserPlus className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-slate-400 tracking-tight italic">{i.email}</p>
                                                    <div className="flex items-center mt-1">
                                                        <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse" />
                                                        <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest italic">Awaiting Acceptance</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-7">
                                            <div className="inline-flex items-center bg-white text-slate-400 px-4 py-2 rounded-2xl border border-slate-100 space-x-2 italic">
                                                <span className="text-[11px] font-black uppercase tracking-widest">{i.role} (PENDING)</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-7 text-center">
                                            <span className="text-[10px] text-slate-300 italic font-medium tracking-tight">Data unavailable</span>
                                        </td>
                                        <td className="px-10 py-7 text-right">
                                            <button className="p-3 text-slate-300 hover:text-slate-600 transition-all">
                                                <Settings className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {team.members?.length === 0 && (!team.invites || team.invites.length === 0) && (
                        <div className="p-20 text-center space-y-4">
                            <Users className="w-16 h-16 text-slate-100 mx-auto" />
                            <p className="font-black text-slate-300 uppercase tracking-[0.3em]">No operators detected</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
