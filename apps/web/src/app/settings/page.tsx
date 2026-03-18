'use client';

import { useState } from 'react';
import {
    User,
    Linkedin,
    Shield,
    Bell,
    CreditCard,
    Lock,
    Globe,
    ChevronRight,
    Sparkles,
    Trash2,
    Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LinkedInConnection from '@/components/LinkedInConnection';
import { cn } from '@/lib/utils';
import { TopBar } from '@/components/TopBar';

const settingsNav = [
    { label: 'Account', icon: User, key: 'account' },
    { label: 'LinkedIn', icon: Linkedin, key: 'linkedin' },
    { label: 'Safety & Limits', icon: Shield, key: 'safety' },
    { label: 'Notifications', icon: Bell, key: 'notifications' },
    { label: 'Subscription', icon: CreditCard, key: 'billing' },
    { label: 'Integrations', icon: Globe, key: 'integrations' },
];

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState('account');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1500);
    };

    return (
        <div className="min-h-full bg-slate-50 flex flex-col">
            <TopBar
                title="Settings"
                description="Manage your account preferences and integrations."
                action={
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                    </button>
                }
            />

            <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidemenu */}
                <div className="space-y-4">
                    <div className="bg-white rounded-[2.5rem] border shadow-sm p-4 space-y-1">
                        {settingsNav.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => setActiveSection(item.key)}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group font-bold text-sm",
                                    activeSection === item.key
                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                        : "text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                <div className="flex items-center space-x-3">
                                    <item.icon className={cn("w-5 h-5", activeSection === item.key ? "text-white" : "text-slate-400 group-hover:text-primary")} />
                                    <span>{item.label}</span>
                                </div>
                                <ChevronRight className={cn("w-4 h-4 opacity-50", activeSection === item.key ? "text-white" : "hidden group-hover:block")} />
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group border border-white/10 shadow-2xl">
                        <Sparkles className="absolute -right-4 -top-4 w-24 h-24 text-white/10" />
                        <h4 className="font-black text-lg relative z-10">Advanced Plan</h4>
                        <p className="text-xs text-white/60 mt-1 relative z-10 font-bold mb-6">Currently active</p>
                        <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                            Manage Subscription
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            {activeSection === 'account' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] border shadow-sm p-8">
                                        <h3 className="text-xl font-black text-slate-900 mb-8">Profile Information</h3>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                                                <input
                                                    type="text"
                                                    defaultValue="Shiva Singh"
                                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                                <input
                                                    type="email"
                                                    defaultValue="shiva@example.com"
                                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-12 flex items-center space-x-8">
                                            <div className="w-24 h-24 rounded-[2rem] bg-slate-100 flex items-center justify-center border-4 border-slate-50 overflow-hidden shadow-inner">
                                                <User className="w-10 h-10 text-slate-300" />
                                            </div>
                                            <div>
                                                <div className="flex space-x-4">
                                                    <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all">Change Avatar</button>
                                                    <button className="px-6 py-2.5 bg-slate-100 text-red-500 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-50 transition-all">Remove</button>
                                                </div>
                                                <p className="text-xs text-slate-400 font-bold mt-4 uppercase tracking-widest">Square or round image, min 400x400px</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] border shadow-sm p-8">
                                        <div className="flex items-center justify-between mb-8">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">Security</h3>
                                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest text-[10px]">Two-factor authentication & password</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl group">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                                        <Lock className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-900">Password</p>
                                                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest text-[9px]">Last changed 3 months ago</p>
                                                    </div>
                                                </div>
                                                <button className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider hover:border-primary hover:text-primary transition-all shadow-sm">Update</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 border-2 border-dashed border-red-100 rounded-[2.5rem] bg-red-50/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-black text-red-500">Danger Zone</h4>
                                                <p className="text-sm font-bold text-red-400/80 mt-1">Permanently delete your account and all associated data.</p>
                                            </div>
                                            <button className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95">
                                                <Trash2 className="w-4 h-4" />
                                                <span>Delete Account</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'linkedin' && (
                                <LinkedInConnection />
                            )}

                            {activeSection !== 'account' && activeSection !== 'linkedin' && (
                                <div className="bg-white rounded-[3rem] border shadow-xl shadow-slate-200/50 p-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-white shadow-inner">
                                        <Sparkles className="w-10 h-10 text-slate-200" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900">Coming Soon</h3>
                                    <p className="text-slate-400 font-bold mt-2 max-w-sm mx-auto uppercase tracking-widest text-xs">
                                        We're polishing this section to ensure the best experience. Stay tuned!
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
