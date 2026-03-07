"use client";

import { useState } from 'react';
import Link from 'next/link';
import IntegrationsSettings from '@/components/IntegrationsSettings';
import {
    User,
    Linkedin,
    Clock,
    Send,
    Puzzle,
    FileText,
    ClipboardList,
    Globe,
    Handshake,
} from 'lucide-react';

const settingsNav = [
    { icon: User, label: 'My account', key: 'account' },
    { icon: Linkedin, label: 'LinkedIn Account', key: 'linkedin' },
    { icon: Clock, label: 'Account activity', key: 'activity' },
    { icon: Send, label: 'Email accounts', key: 'email' },
    { icon: Puzzle, label: 'Integrations', key: 'integrations', badge: 'BETA' },
    { icon: FileText, label: 'Invoices', key: 'invoices' },
    { icon: ClipboardList, label: 'Import history', key: 'import' },
];

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState('account');

    return (
        <div className="flex space-x-8 animate-in fade-in duration-500">
            {/* Settings Nav */}
            <div className="w-60 flex-shrink-0 space-y-1">
                <h2 className="text-2xl font-black text-slate-800 mb-4">Settings</h2>
                {settingsNav.map((item) => (
                    <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm transition-all ${activeSection === item.key
                            ? 'bg-white shadow-sm text-slate-800 font-bold'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                        {item.badge && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold ml-auto">
                                {item.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Settings Content */}
            <div className="flex-1 space-y-6">
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">
                    {settingsNav.find(s => s.key === activeSection)?.label || 'Settings'}
                </h1>

                {activeSection === 'account' && (
                    <div className="space-y-6">
                        {/* About You */}
                        <div className="bg-white rounded-3xl border shadow-sm p-6">
                            <div className="flex items-center space-x-6">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black">
                                    S
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">First name</label>
                                        <input
                                            type="text"
                                            defaultValue="Shiva"
                                            className="w-full mt-1 px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last name</label>
                                        <input
                                            type="text"
                                            defaultValue="Singh"
                                            className="w-full mt-1 px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Email Preferences */}
                        <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-slate-800 rounded-xl">
                                        <Send className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">Email preferences</p>
                                        <p className="text-xs text-slate-400">Choose the emails you want to receive from us</p>
                                    </div>
                                </div>
                                <button className="bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-200 transition-colors">
                                    Manage my email preferences
                                </button>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact email</label>
                                <input
                                    type="email"
                                    defaultValue="s********a@g****.com"
                                    className="w-full mt-1 px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    disabled
                                />
                            </div>
                            <div className="flex justify-end">
                                <button className="bg-slate-200 text-white px-6 py-2 rounded-xl text-xs font-bold cursor-not-allowed">
                                    Update
                                </button>
                            </div>
                        </div>

                        {/* Application Language */}
                        <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-slate-800 rounded-xl">
                                    <Globe className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">Application language</p>
                                    <p className="text-xs text-slate-400">Choose your preferred language to use the app</p>
                                </div>
                            </div>
                            <select className="w-full px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                <option>🇬🇧 English</option>
                                <option>🇫🇷 French</option>
                                <option>🇮🇳 Hindi</option>
                            </select>
                            <div className="flex justify-end">
                                <button className="bg-slate-200 text-white px-6 py-2 rounded-xl text-xs font-bold cursor-not-allowed">
                                    Update
                                </button>
                            </div>
                        </div>

                        {/* Affiliation */}
                        <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-slate-800 rounded-xl">
                                    <Handshake className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">Affiliation</p>
                                    <p className="text-xs text-slate-400">Enter your ambassador&apos;s affiliation code</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Affiliation Code (12 characters)</label>
                                <input
                                    type="text"
                                    placeholder="XXXXXXXXXXXX"
                                    maxLength={12}
                                    className="w-full mt-1 px-4 py-2 border rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button className="bg-slate-200 text-white px-6 py-2 rounded-xl text-xs font-bold cursor-not-allowed">
                                    Validate
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'linkedin' && (
                    <div className="bg-white rounded-3xl border shadow-sm p-8 text-center">
                        <Linkedin className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold">LinkedIn account settings</p>
                        <p className="text-sm text-slate-400 mt-1">Connect and manage your LinkedIn session cookie here.</p>
                    </div>
                )}

                {activeSection === 'integrations' && (
                    <IntegrationsSettings />
                )}

                {activeSection !== 'account' && activeSection !== 'linkedin' && activeSection !== 'integrations' && (
                    <div className="bg-white rounded-3xl border shadow-sm p-8 text-center">
                        <p className="text-slate-500 font-bold">
                            {settingsNav.find(s => s.key === activeSection)?.label} settings
                        </p>
                        <p className="text-sm text-slate-400 mt-1">This section is coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
