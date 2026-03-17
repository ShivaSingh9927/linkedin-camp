'use client';

import React, { useState, useEffect } from 'react';
import {
    Shield,
    Plus,
    Trash2,
    Activity,
    Globe,
    User,
    AlertCircle,
    CheckCircle2,
    Ban,
    Filter,
    RefreshCw,
    Search
} from 'lucide-react';
import Link from 'next/link';

interface Proxy {
    id: string;
    proxyIp: string;
    proxyHost: string;
    proxyPort: number;
    proxyCountry: string | null;
    tierClass: 'ECONOMY' | 'RESIDENTIAL';
    maxUsers: number;
    failureCount: number;
    banned: boolean;
    linkedinBanned: boolean;
    lockedUntil: string | null;
    assignedUsers: Array<{ id: string, email: string, tier: string }>;
    _count: { assignedUsers: number };
}

export default function ProxyAdminPage() {
    const [proxies, setProxies] = useState<Proxy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'BANNED' | 'HEALTHY' | 'LINKEDIN_BANNED'>('ALL');

    const fetchProxies = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/proxies`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setProxies(data.proxies);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to fetch proxies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProxies();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this proxy?')) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/proxies/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (res.ok) {
                setProxies(proxies.filter(p => p.id !== id));
            }
        } catch (err) {
            alert('Delete failed');
        }
    };

    const filteredProxies = proxies.filter(p => {
        const matchesSearch = p.proxyHost.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.proxyCountry?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        if (filter === 'BANNED') return matchesSearch && p.banned;
        if (filter === 'HEALTHY') return matchesSearch && !p.banned && !p.linkedinBanned;
        if (filter === 'LINKEDIN_BANNED') return matchesSearch && p.linkedinBanned;
        return matchesSearch;
    });

    return (
        <div className="p-8 bg-slate-950 min-h-screen text-slate-200">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Infrastructure Management
                        </h1>
                        <p className="text-slate-400 mt-1">Monitor and manage proxy health & user assignments</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={fetchProxies}
                            className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Refresh Stats"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <Link
                            href="/admin/proxies/add"
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add Proxies
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="relative col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by Host or Country..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 col-span-2">
                        {(['ALL', 'HEALTHY', 'BANNED', 'LINKEDIN_BANNED'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${filter === f
                                        ? 'bg-slate-800 border-slate-700 text-blue-400'
                                        : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-700'
                                    }`}
                            >
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Proxy Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading && proxies.length === 0 ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="h-64 bg-slate-900/50 animate-pulse rounded-2xl border border-slate-800" />
                        ))
                    ) : filteredProxies.length === 0 ? (
                        <div className="col-span-full py-20 text-center">
                            <Shield className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-500">No proxies found matching filters</p>
                        </div>
                    ) : (
                        filteredProxies.map((proxy) => (
                            <div
                                key={proxy.id}
                                className={`relative bg-slate-900 border rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-950/20 transition-all group overflow-hidden ${proxy.banned ? 'border-red-900/50' : proxy.linkedinBanned ? 'border-yellow-900/50' : 'border-slate-800'
                                    }`}
                            >
                                {/* Status Glow */}
                                <div className={`absolute -top-12 -right-12 w-24 h-24 blur-3xl opacity-20 ${proxy.banned ? 'bg-red-500' : proxy.linkedinBanned ? 'bg-yellow-500' : 'bg-green-500'
                                    }`} />

                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${proxy.banned ? 'bg-red-500/10 text-red-400' : proxy.linkedinBanned ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'
                                            }`}>
                                            {proxy.banned ? <Ban className="w-5 h-5" /> : proxy.linkedinBanned ? <AlertCircle className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-100 uppercase tracking-tight text-sm">
                                                {proxy.proxyHost}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                                <Globe className="w-3 h-3" />
                                                {proxy.proxyCountry || 'Unknown Location'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(proxy.id)}
                                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    {/* Stats Row */}
                                    <div className="flex justify-between text-xs py-2 border-y border-slate-800/50">
                                        <div className="text-slate-500 uppercase font-medium">Capacity</div>
                                        <div className="text-slate-200">
                                            <span className={proxy._count.assignedUsers >= proxy.maxUsers ? 'text-orange-400' : 'text-slate-200'}>
                                                {proxy._count.assignedUsers}
                                            </span>
                                            <span className="text-slate-600"> / {proxy.maxUsers} Users</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-xs pb-2 border-b border-slate-800/50">
                                        <div className="text-slate-500 uppercase font-medium">Health Logs</div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${proxy.failureCount === 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                {proxy.failureCount} Consecutive Fails
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tier Badge */}
                                    <div className="flex justify-between items-center pt-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${proxy.tierClass === 'RESIDENTIAL' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                            {proxy.tierClass}
                                        </span>

                                        {proxy.lockedUntil && (
                                            <span className="text-[10px] text-orange-400 flex items-center gap-1 font-medium bg-orange-400/10 px-2 py-0.5 rounded border border-orange-400/20 animate-pulse">
                                                <Activity className="w-3 h-3" />
                                                ACTIVE LOCK
                                            </span>
                                        )}
                                    </div>

                                    {/* Assigned Users Detail */}
                                    {proxy.assignedUsers.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-800">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Assigned Users</p>
                                            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                                {proxy.assignedUsers.map(u => (
                                                    <div key={u.id} className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-800/50 p-1.5 rounded border border-slate-800">
                                                        <User className="w-3 h-3 text-slate-500" />
                                                        <span className="truncate flex-1">{u.email}</span>
                                                        <span className="text-slate-600 font-bold">{u.tier}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
