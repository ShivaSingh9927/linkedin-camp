"use client";

import { MessageSquare, Send, Calendar, Bell, Tag } from 'lucide-react';

export default function InboxPage() {
    const features = [
        { icon: Send, title: 'Templates', desc: "Don't rewrite for nothing, save time" },
        { icon: Calendar, title: 'Scheduled messages', desc: 'Send your follow-ups at a specific date' },
        { icon: Bell, title: 'Conversation reminders', desc: 'Bring up conversations at a specific date' },
        { icon: Tag, title: "Prospects' tags", desc: 'Organize your Inbox the way you want' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
            {/* Headlines */}
            <div className="text-center pt-8">
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                    LinkedIn messaging.
                </h1>
                <h1 className="text-4xl font-black text-indigo-600 tracking-tight">
                    Only better.
                </h1>
            </div>

            {/* Feature Card */}
            <div className="bg-white rounded-3xl shadow-sm border p-8 space-y-6">
                <div className="flex items-center space-x-3">
                    <MessageSquare className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-black text-slate-800">Test the Inbox for free</h2>
                </div>
                <p className="text-slate-500 font-medium">
                    500 conversations managed at no cost and with no time limit!
                </p>

                <div className="space-y-4">
                    {features.map((f) => (
                        <div key={f.title} className="flex items-start space-x-4 p-4 bg-slate-50 rounded-2xl">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                <f.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{f.title}</p>
                                <p className="text-sm text-slate-500">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                    Test Inbox for free 😎
                </button>
                <p className="text-xs text-center text-slate-400 italic">No credit card required</p>
            </div>
        </div>
    );
}
