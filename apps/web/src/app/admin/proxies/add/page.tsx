'use client';

import React, { useState } from 'react';
import {
    Plus,
    ArrowLeft,
    Shield,
    Globe,
    Database,
    Terminal,
    AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AddProxiesPage() {
    const router = useRouter();
    const [proxiesText, setProxiesText] = useState('');
    const [country, setCountry] = useState('');
    const [tierClass, setTierClass] = useState<'ECONOMY' | 'RESIDENTIAL'>('ECONOMY');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/proxies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ proxiesText, country, tierClass })
            });
            const data = await res.json();
            setResult(data);
            if (data.success && data.added > 0) {
                setTimeout(() => router.push('/admin/proxies'), 2000);
            }
        } catch (err) {
            alert('Failed to add proxies');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-slate-950 min-h-screen text-slate-200">
            <div className="max-w-3xl mx-auto">
                <Link
                    href="/admin/proxies"
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors mb-8 text-sm group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Infrastructure
                </Link>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                    {/* Accent decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl -z-0" />

                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold text-white mb-2">Import Infrastructure</h1>
                        <p className="text-slate-400 mb-8 border-b border-slate-800 pb-4">
                            Add dedicated proxies in bulk. Support for specialized tiers and geo-matching.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-blue-400" />
                                        Target Country
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. USA, India, UK"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <Database className="w-4 h-4 text-purple-400" />
                                        Tier Class
                                    </label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-200 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_1rem_center] bg-[length:1.25rem] bg-no-repeat"
                                        value={tierClass}
                                        onChange={(e) => setTierClass(e.target.value as any)}
                                    >
                                        <option value="ECONOMY">ECONOMY (12 Users/IP)</option>
                                        <option value="RESIDENTIAL">RESIDENTIAL (5 Users/IP)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-slate-500" />
                                    Proxy List (host:port:user:pass)
                                </label>
                                <textarea
                                    rows={8}
                                    placeholder="1.2.3.4:8080:user:pass&#10;5.6.7.8:8080:user:pass"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm leading-relaxed"
                                    value={proxiesText}
                                    onChange={(e) => setProxiesText(e.target.value)}
                                />
                            </div>

                            {result && (
                                <div className={`p-4 rounded-2xl border ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    <div className="font-bold flex items-center gap-2 mb-1">
                                        {result.success ? <Shield className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {result.success ? `Successfully added ${result.added} proxies!` : 'Import Errors'}
                                    </div>
                                    {result.errors && (
                                        <ul className="text-xs list-disc list-inside mt-2 space-y-1 opacity-70">
                                            {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                        </ul>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !proxiesText.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
                                Import Proxies
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
