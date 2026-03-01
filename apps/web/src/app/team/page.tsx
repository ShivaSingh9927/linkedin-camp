"use client";

import { BarChart3, RefreshCw, MessageCircle, ShieldCheck } from 'lucide-react';

export default function TeamPage() {
    const features = [
        { icon: BarChart3, title: 'Shared statistics', desc: "Track your team's performance in one place." },
        { icon: RefreshCw, title: 'Inter-account import and lead transfer', desc: 'Manage leads from one account to another in just a few clicks.' },
        { icon: MessageCircle, title: 'Simplified collaboration', desc: 'Easily switch between accounts and manage campaigns.' },
        { icon: ShieldCheck, title: 'Anti-duplicate security', desc: 'Never contact the same person as another team member.' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Team</h1>

            <div className="bg-white rounded-3xl shadow-sm border p-8 space-y-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Easily prospect as a team</h2>
                    <p className="text-slate-500 text-sm mt-1">Customize your team now!</p>
                </div>

                <div className="space-y-4">
                    {features.map((f) => (
                        <div key={f.title} className="flex items-start space-x-4 p-4 bg-slate-50 rounded-2xl">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                <f.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{f.title}</p>
                                <p className="text-sm text-slate-500">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:opacity-90 transition-all shadow-lg">
                    Test with my colleagues
                </button>
            </div>
        </div>
    );
}
