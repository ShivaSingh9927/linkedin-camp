"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    Users,
    UserPlus,
    Shield,
    Trash2,
    Download,
    ChevronRight,
    MessageSquare,
    Eye,
    X,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

interface TeamMember {
    id: string;
    role: Role;
    joinedAt: string;
    user: { id: string; email: string };
    stats?: { activeCampaigns: number; totalLeads: number; hasProxy?: boolean };
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
    tier?: string;
    seatsPurchased?: number;
    maxSeats?: number;
    members: TeamMember[];
    invites: TeamInvite[];
}

interface AnalyticsMember {
    userId: string;
    email: string;
    role: Role;
    activity: { invites: number; messages: number; visits: number };
    pipeline: { leads: number; connected: number; replied: number; replyRate: number };
}

interface Analytics {
    range: string;
    activity: { invites: number; messages: number; visits: number };
    pipeline: { leads: number; connected: number; replied: number; connectedRate: number; repliedRate: number };
    members: AnalyticsMember[];
}

const RANGES: { key: string; label: string; long: string }[] = [
    { key: '7d', label: '7D', long: '7 days' },
    { key: '30d', label: '30D', long: '30 days' },
    { key: '90d', label: '90D', long: '90 days' },
];

const roleColor = (r: Role) => (r === 'OWNER' ? 'text-brand' : r === 'ADMIN' ? 'text-brand-600' : 'text-ink-400');

export default function TeamPage() {
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState<{ hasTeam: boolean; team?: Team; role?: Role } | null>(null);
    const [view, setView] = useState<'perf' | 'members'>('perf');
    const [range, setRange] = useState('30d');
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loadingA, setLoadingA] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
    const [inviteMeta, setInviteMeta] = useState<{ token?: string; emailed?: boolean } | null>(null);

    const fetchTeam = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/team');
            setTeamData(res.data);
        } catch (err) {
            console.error('Failed to fetch team:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAnalytics = useCallback(async (r: string) => {
        try {
            setLoadingA(true);
            const res = await api.get(`/team/analytics?range=${r}`);
            setAnalytics(res.data);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoadingA(false);
        }
    }, []);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);
    useEffect(() => { if (teamData?.hasTeam) fetchAnalytics(range); }, [teamData?.hasTeam, range, fetchAnalytics]);

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

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/team/invite', { teamId: teamData?.team?.id, email: inviteEmail, role: inviteRole });
            setInviteMeta({ token: res.data.token, emailed: res.data.emailed });
            fetchTeam();
            setInviteEmail("");
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to invite member.");
        }
    };

    const handleRemoveMember = async (targetUserId: string) => {
        if (!confirm("Remove this member from the team?")) return;
        try {
            await api.delete(`/team/${teamData?.team?.id}/members/${targetUserId}`);
            fetchTeam();
            fetchAnalytics(range);
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to remove member.");
        }
    };

    const exportCsv = () => {
        if (!analytics) return;
        const head = ['Member', 'Role', 'Invites', 'Messages', 'Visits', 'Leads', 'Connected', 'Replied', 'ReplyRate%'];
        const rows = analytics.members.map((m) => [
            m.email, m.role, m.activity.invites, m.activity.messages, m.activity.visits,
            m.pipeline.leads, m.pipeline.connected, m.pipeline.replied, m.pipeline.replyRate,
        ]);
        const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-performance-${range}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // --- Loading ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
            </div>
        );
    }

    // --- Empty state ---
    if (!teamData?.hasTeam) {
        return (
            <div className="max-w-xl mx-auto py-12 px-6">
                <div className="bg-white rounded-panel shadow-lift border border-line p-10 text-center space-y-8">
                    <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto">
                        <Users className="w-10 h-10 text-brand" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Create a team</h1>
                        <p className="text-ink-400 mt-2 font-medium">Bring your colleagues into one workspace to run outreach together.</p>
                    </div>
                    <form onSubmit={handleCreateTeam} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Team name (e.g. Sales Rocket)"
                            className="w-full px-6 py-4 bg-surface border-2 border-line rounded-control focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand font-bold text-lg transition-all"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            required
                        />
                        <button
                            disabled={isCreating}
                            className="w-full bg-ink-900 text-white py-4 rounded-control font-black uppercase text-sm tracking-widest hover:bg-black transition-all active:scale-[.98]"
                        >
                            {isCreating ? "Creating…" : "Set up team →"}
                        </button>
                    </form>
                    <p className="pt-6 border-t border-line text-[11px] font-bold text-ink-400 uppercase tracking-widest">
                        Or check your email for an invite from your team admin
                    </p>
                </div>
            </div>
        );
    }

    // --- Dashboard ---
    const team = teamData.team!;
    const myRole = teamData.role;
    const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
    const seatCap = team.maxSeats ?? team.members.length;
    const seatsUsed = team.members.length + (team.invites?.length || 0);
    const atCapacity = seatsUsed >= seatCap;
    const rangeLong = RANGES.find((r) => r.key === range)?.long || range;

    const toggleBtn = (active: boolean) => cn(
        'px-4 py-2 rounded-chip font-black text-[11px] tracking-[0.1em] uppercase transition-all',
        active ? 'bg-ink-900 text-white' : 'text-brand-600 hover:text-brand',
    );
    const rangeBtn = (active: boolean) => cn(
        'px-3 py-1.5 rounded-chip font-black text-[11px] tracking-[0.1em] transition-all',
        active ? 'bg-brand text-white' : 'text-brand-600 hover:text-brand',
    );

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-3xl sm:text-4xl font-black text-foreground uppercase tracking-tighter italic leading-none">{team.name}</h1>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-brand text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-full">
                    <Shield className="w-3 h-3" />{myRole}
                </span>
            </div>

            {/* Card */}
            <div className="bg-white border border-line rounded-panel shadow-soft p-5 sm:p-6">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="inline-flex bg-surface rounded-chip p-1">
                        <button className={toggleBtn(view === 'perf')} onClick={() => setView('perf')}>Performance</button>
                        <button className={toggleBtn(view === 'members')} onClick={() => setView('members')}>Members</button>
                    </div>

                    {view === 'perf' ? (
                        <div className="flex items-center gap-2.5">
                            <div className="inline-flex bg-surface rounded-chip p-1">
                                {RANGES.map((r) => (
                                    <button key={r.key} className={rangeBtn(range === r.key)} onClick={() => setRange(r.key)}>{r.label}</button>
                                ))}
                            </div>
                            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 border-[1.5px] border-ink-900 text-ink-900 font-black text-[11px] tracking-[0.08em] uppercase px-3.5 py-2 rounded-control hover:bg-ink-900 hover:text-white transition-all">
                                <Download className="w-4 h-4" />CSV
                            </button>
                        </div>
                    ) : canManage && (
                        <button
                            onClick={() => { setIsInviting(!isInviting); setInviteMeta(null); }}
                            disabled={atCapacity}
                            className={cn(
                                'inline-flex items-center gap-1.5 font-black text-[11px] tracking-[0.08em] uppercase px-4 py-2.5 rounded-control transition-all',
                                atCapacity ? 'bg-surface text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-black active:scale-[.98]',
                            )}
                        >
                            <UserPlus className="w-4 h-4" />Invite
                        </button>
                    )}
                </div>

                {/* ---- PERFORMANCE ---- */}
                {view === 'perf' && (
                    <div className={cn('transition-opacity', loadingA && 'opacity-50')}>
                        {/* Activity */}
                        <p className="label !text-ink-400 mb-2.5">Activity — last {rangeLong}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                            {[
                                { label: 'Invites', v: analytics?.activity.invites, icon: UserPlus, bg: 'bg-brand-50', fg: 'text-brand' },
                                { label: 'Messages', v: analytics?.activity.messages, icon: MessageSquare, bg: 'bg-sky-50', fg: 'text-sky-600' },
                                { label: 'Visits', v: analytics?.activity.visits, icon: Eye, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
                            ].map((c) => (
                                <div key={c.label} className="bg-surface border border-line rounded-card p-4 flex items-center gap-3.5">
                                    <div className={cn('w-11 h-11 rounded-control grid place-items-center', c.bg, c.fg)}>
                                        <c.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="label !text-ink-400 !text-[10px]">{c.label}</p>
                                        <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">{(c.v ?? 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pipeline */}
                        <p className="label !text-ink-400 mb-2.5">Pipeline — current</p>
                        <div className="flex items-stretch gap-2 mb-6">
                            <div className="flex-1 bg-ink-900 text-white rounded-card p-4">
                                <p className="label !text-ink-400 !text-[10px]">Leads</p>
                                <p className="text-2xl font-black tracking-tight tabular-nums">{(analytics?.pipeline.leads ?? 0).toLocaleString()}</p>
                            </div>
                            <div className="grid place-items-center text-ink-400"><ChevronRight className="w-5 h-5" /></div>
                            <div className="flex-1 bg-brand-50 rounded-card p-4">
                                <p className="label !text-brand !text-[10px]">Connected</p>
                                <p className="text-2xl font-black text-brand-700 tracking-tight tabular-nums">
                                    {(analytics?.pipeline.connected ?? 0).toLocaleString()} <span className="text-[13px] font-extrabold text-brand-600">{analytics?.pipeline.connectedRate ?? 0}%</span>
                                </p>
                            </div>
                            <div className="grid place-items-center text-ink-400"><ChevronRight className="w-5 h-5" /></div>
                            <div className="flex-1 bg-emerald-50 rounded-card p-4">
                                <p className="label !text-emerald-600 !text-[10px]">Replied</p>
                                <p className="text-2xl font-black text-emerald-800 tracking-tight tabular-nums">
                                    {(analytics?.pipeline.replied ?? 0).toLocaleString()} <span className="text-[13px] font-extrabold text-emerald-500">{analytics?.pipeline.repliedRate ?? 0}%</span>
                                </p>
                            </div>
                        </div>

                        {/* Leaderboard */}
                        <p className="label !text-ink-400 mb-2.5">Per-member leaderboard</p>
                        <div className="overflow-x-auto border border-line rounded-card">
                            <table className="w-full border-collapse text-[13px] min-w-[560px]">
                                <thead>
                                    <tr className="bg-surface">
                                        <th className="text-left px-4 py-3 label !text-ink-400 !text-[9px]">Member</th>
                                        <th className="text-right px-2 py-3 label !text-ink-400 !text-[9px]">Inv</th>
                                        <th className="text-right px-2 py-3 label !text-ink-400 !text-[9px]">Msg</th>
                                        <th className="text-right px-2 py-3 label !text-ink-400 !text-[9px]">Vis</th>
                                        <th className="text-right px-2 py-3 label !text-ink-400 !text-[9px] border-l border-line">Leads</th>
                                        <th className="text-right px-2 py-3 label !text-ink-400 !text-[9px]">Conn</th>
                                        <th className="text-right px-2 py-3 label !text-ink-400 !text-[9px]">Repl</th>
                                        <th className="text-right px-4 py-3 label !text-ink-400 !text-[9px]">Reply%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(analytics?.members || []).map((m) => (
                                        <tr key={m.userId} className="border-t border-line">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-chip bg-ink-900 text-white grid place-items-center font-black text-xs">{(m.email[0] || '?').toUpperCase()}</div>
                                                    <div>
                                                        <div className="font-extrabold text-foreground">{m.email}</div>
                                                        <div className={cn('text-[9px] font-black tracking-[0.12em] uppercase', roleColor(m.role))}>{m.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-right px-2 py-3 font-bold text-ink-700 tabular-nums">{m.activity.invites}</td>
                                            <td className="text-right px-2 py-3 font-bold text-ink-700 tabular-nums">{m.activity.messages}</td>
                                            <td className="text-right px-2 py-3 font-bold text-ink-700 tabular-nums">{m.activity.visits}</td>
                                            <td className="text-right px-2 py-3 font-bold text-foreground tabular-nums border-l border-line">{m.pipeline.leads}</td>
                                            <td className="text-right px-2 py-3 font-bold text-brand tabular-nums">{m.pipeline.connected}</td>
                                            <td className="text-right px-2 py-3 font-bold text-emerald-600 tabular-nums">{m.pipeline.replied}</td>
                                            <td className="text-right px-4 py-3 font-black text-emerald-600 tabular-nums">{m.pipeline.replyRate}%</td>
                                        </tr>
                                    ))}
                                    {!loadingA && (analytics?.members || []).length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-400 font-medium">No activity yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ---- MEMBERS ---- */}
                {view === 'members' && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="label !text-ink-400">Seats</p>
                            <span className="bg-brand-50 text-brand font-black text-[10px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full">
                                {seatsUsed} / {seatCap} seats used
                            </span>
                        </div>

                        {/* Invite panel */}
                        <AnimatePresence>
                            {isInviting && canManage && (
                                <motion.form
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    onSubmit={handleInvite}
                                    className="overflow-hidden mb-4"
                                >
                                    <div className="bg-surface border border-brand/20 rounded-card p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="label !text-ink-500">Invite a teammate</p>
                                            <button type="button" onClick={() => setIsInviting(false)} className="text-ink-400 hover:text-foreground"><X className="w-4 h-4" /></button>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="email" required placeholder="name@company.com" value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                className="flex-1 px-4 py-2.5 bg-white border border-line rounded-control focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand font-semibold text-sm"
                                            />
                                            <div className="inline-flex bg-white border border-line rounded-control p-1">
                                                {(['MEMBER', 'ADMIN'] as const).map((r) => (
                                                    <button key={r} type="button" onClick={() => setInviteRole(r)}
                                                        className={cn('px-4 py-1.5 rounded-chip font-black text-[11px] tracking-[0.1em] uppercase transition-all', inviteRole === r ? 'bg-brand text-white' : 'text-ink-400')}>{r}</button>
                                                ))}
                                            </div>
                                            <button className="bg-ink-900 text-white font-black text-[11px] tracking-[0.1em] uppercase px-5 py-2.5 rounded-control hover:bg-black active:scale-[.98]">Send invite</button>
                                        </div>
                                        {inviteMeta && (
                                            <p className="text-[12px] font-semibold text-emerald-600">
                                                {inviteMeta.emailed ? 'Invite emailed.' : 'Invite created — copy the link:'}{' '}
                                                <span className="font-mono text-ink-500 break-all">{`${typeof window !== 'undefined' ? window.location.origin : ''}/team/join?token=${inviteMeta.token}`}</span>
                                            </p>
                                        )}
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {/* Roster */}
                        <div className="flex flex-col gap-2.5">
                            {team.members.map((m) => (
                                <div key={m.id} className="flex items-center justify-between border border-line rounded-card p-3.5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-control bg-ink-900 text-white grid place-items-center font-black">{(m.user.email[0] || '?').toUpperCase()}</div>
                                        <div>
                                            <div className="font-extrabold text-foreground text-sm">{m.user.email}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={cn('text-[9px] font-black tracking-[0.12em] uppercase', roleColor(m.role))}>{m.role}</span>
                                                <span className="text-[11px] text-ink-400 font-medium">· {m.stats?.totalLeads ?? 0} leads · {m.stats?.activeCampaigns ?? 0} active</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
                                        </span>
                                        {canManage && m.role !== 'OWNER' ? (
                                            <button onClick={() => handleRemoveMember(m.user.id)} className="w-9 h-9 rounded-control bg-red-50 text-red-500 grid place-items-center hover:bg-red-100 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        ) : m.role === 'OWNER' && (
                                            <span className="text-[10px] font-black tracking-[0.1em] text-ink-400 uppercase">Owner</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pending invites */}
                        {(team.invites || []).length > 0 && (
                            <div className="mt-3 space-y-2">
                                {team.invites.map((inv) => (
                                    <div key={inv.id} className="bg-surface border border-dashed border-brand/30 rounded-card px-4 py-3 flex items-center justify-between">
                                        <span className="text-[12px] font-semibold text-ink-500">Pending invite — <span className="text-foreground">{inv.email}</span></span>
                                        <span className="text-[10px] font-black tracking-[0.12em] text-fuchsia-600 uppercase">Pending</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
