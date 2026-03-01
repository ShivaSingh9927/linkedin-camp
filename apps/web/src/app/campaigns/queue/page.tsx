"use client";

import { Linkedin, Mail, Rocket, Send, Eye, UserPlus } from 'lucide-react';

const quotas = [
    { label: 'Invitations', remaining: 87, total: 100, icon: UserPlus },
    { label: 'Messages', remaining: 136, total: 150, icon: Send },
    { label: 'Profile visits', remaining: 145, total: 150, icon: Eye },
    { label: 'Follows', remaining: 91, total: 100, icon: UserPlus },
];

const filters = ['LinkedIn', 'Email', 'My campaigns', 'Action type'];

export default function QueuePage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            {/* Left Column - Queue */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Queue</h1>
                        <div className="flex items-center space-x-3 mt-2">
                            <span className="text-sm font-bold text-slate-600">Queued actions</span>
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                        </div>
                    </div>
                    <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                        Update activity
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center space-x-2">
                    {filters.map((f) => (
                        <button
                            key={f}
                            className="px-4 py-2 rounded-full border text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Empty State */}
                <div className="bg-white rounded-3xl border shadow-sm p-20 text-center">
                    <Rocket className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-lg font-black text-slate-600">No action for the moment</p>
                    <p className="text-sm text-slate-400 mt-1">Start a campaign to see queued actions here.</p>
                    <button className="mt-4 bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                        Start a campaign
                    </button>
                </div>
            </div>

            {/* Right Column - Daily Quotas */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Daily quotas</h2>
                    <p className="text-sm text-slate-400 mt-0.5 italic">Updates daily</p>
                </div>

                <div className="space-y-4">
                    {quotas.map((q) => {
                        const pct = Math.round((q.remaining / q.total) * 100);
                        return (
                            <div key={q.label} className="bg-white rounded-2xl border shadow-sm p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <q.icon className="w-4 h-4" />
                                        </div>
                                        <span className="font-bold text-slate-700 text-sm">{q.label}</span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">{q.remaining} left</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
