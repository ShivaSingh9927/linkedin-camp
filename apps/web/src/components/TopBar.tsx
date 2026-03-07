"use client";

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Bell,
    Coins,
    Sparkles,
    CheckCircle2,
    MessageSquare,
    AlertTriangle,
    Target,
    X,
    Users,
    ChevronDown,
    Info,
    ShieldAlert
} from 'lucide-react';

import api from '@/lib/api';

// Notification types mapping
const NOTIF_CONFIG: Record<string, any> = {
    INFO: {
        icon: Info,
        iconColor: 'text-sky-500',
        iconBg: 'bg-sky-50',
    },
    THROTTLED_WARNING: {
        icon: ShieldAlert,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-50',
    },
    new_reply: {
        icon: MessageSquare,
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-50',
    },
    campaign_complete: {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-50',
    },
    campaign_error: {
        icon: AlertTriangle,
        iconColor: 'text-red-500',
        iconBg: 'bg-red-50',
    },
    warning: {
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-50',
    },
    reminder: {
        icon: Target,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-50',
    },
    default: {
        icon: Bell,
        iconColor: 'text-slate-500',
        iconBg: 'bg-slate-50',
    }
};

interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    meta?: any;
}

export function TopBar() {
    const pathname = usePathname();
    const isPricing = pathname === '/pricing';
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const switcherRef = useRef<HTMLDivElement>(null);

    // Ghosting State
    const [teamData, setTeamData] = useState<any>(null);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [operatingUserId, setOperatingUserId] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOperatingUserId(localStorage.getItem('operatingUserId') || 'ME');
        }
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Fetch notifications
    const fetchNotifications = async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            const res = await api.get('/inbox/notifications');
            setNotifications(res.data);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // Fetch team for ghosting
    const fetchTeam = async () => {
        try {
            const res = await api.get('/team');
            if (res.data.hasTeam && res.data.role === 'ADMIN') {
                setTeamData(res.data.team);
            }
        } catch (err) {
            console.error('Failed to fetch team for ghosting:', err);
        }
    };

    // Auto-refresh notifications every 30 seconds
    useEffect(() => {
        fetchNotifications(true);
        fetchTeam();
        const interval = setInterval(() => fetchNotifications(), 30000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
            if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
                setShowSwitcher(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSwitchUser = (userId: string) => {
        if (userId === 'ME') {
            localStorage.removeItem('operatingUserId');
        } else {
            localStorage.setItem('operatingUserId', userId);
        }
        window.location.reload(); // Refresh app to load new context
    };

    const markAsRead = async (id?: string) => {
        try {
            await api.post('/inbox/notifications/read', { ids: id ? [id] : undefined });
            // Optimistic update
            setNotifications(prev => prev.map(n =>
                (!id || n.id === id) ? { ...n, read: true } : n
            ));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const getTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSecs < 60) return 'Just now';
        const mins = Math.floor(diffInSecs / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    return (
        <div className="flex items-center space-x-3">
            {/* Tokens */}
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-black text-slate-700">120</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">tokens</span>
            </div>

            {/* Account Switcher (Ghosting) */}
            {teamData && (
                <div className="relative" ref={switcherRef}>
                    <button
                        onClick={() => setShowSwitcher(!showSwitcher)}
                        className={`flex items-center space-x-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm transition-all hover:border-indigo-300 ${operatingUserId !== 'ME' ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : ''}`}
                    >
                        <Users className={`w-4 h-4 ${operatingUserId !== 'ME' ? 'text-indigo-600' : 'text-slate-500'}`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${operatingUserId !== 'ME' ? 'text-indigo-700' : 'text-slate-600'}`}>
                            {operatingUserId === 'ME' ? 'Operating As: Me' : 'Ghost Mode Active'}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {showSwitcher && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white border rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-5 py-4 border-b bg-slate-50/50">
                                <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">Crew Ghosting</h4>
                                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                                    Switch into any crewmate's account to manage their campaigns and inbox.
                                </p>
                            </div>
                            <div className="max-h-64 overflow-y-auto divide-y bg-white">
                                <button
                                    onClick={() => handleSwitchUser('ME')}
                                    className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors flex items-center space-x-3 ${operatingUserId === 'ME' ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                                        ME
                                    </div>
                                    <span className={`text-xs font-black tracking-widest uppercase ${operatingUserId === 'ME' ? 'text-indigo-600' : 'text-slate-700'}`}>
                                        My Account
                                    </span>
                                </button>
                                {teamData.members.map((m: any) => (
                                    <button
                                        key={m.userId}
                                        onClick={() => handleSwitchUser(m.userId)}
                                        className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors flex items-center space-x-3 ${operatingUserId === m.userId ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs uppercase">
                                            {m.user.email.substring(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-black tracking-widest truncate ${operatingUserId === m.userId ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                {m.user.email}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Notifications */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2.5 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                >
                    <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-indigo-600' : 'text-slate-500'}`} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown */}
                {showNotifications && (
                    <div className="absolute right-0 top-full mt-2 w-96 bg-white border rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50/50">
                            <h4 className="font-black text-sm text-slate-800 uppercase tracking-tight">Notifications</h4>
                            <div className="flex items-center space-x-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAsRead()}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[380px] overflow-y-auto divide-y bg-white">
                            {notifications.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-400">All caught up!</p>
                                    <p className="text-xs text-slate-300 mt-1">No new notifications</p>
                                </div>
                            ) : (
                                notifications.map((notif) => {
                                    const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.default;
                                    const Icon = config.icon;
                                    return (
                                        <div
                                            key={notif.id}
                                            onClick={() => !notif.read && markAsRead(notif.id)}
                                            className={`px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group ${!notif.read ? 'bg-indigo-50/30' : ''}`}
                                        >
                                            <div className="flex items-start space-x-3">
                                                <div className={`p-2 rounded-xl ${config.iconBg} flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                                    <Icon className={`w-4 h-4 ${config.iconColor}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <p className={`text-sm tracking-tight ${notif.read ? 'font-bold text-slate-600' : 'font-black text-slate-800'}`}>
                                                            {notif.title}
                                                        </p>
                                                        {!notif.read && (
                                                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                    <p className={`text-xs mt-0.5 ${notif.read ? 'text-slate-400' : 'text-slate-500 font-medium'}`}>
                                                        {notif.body}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-wider">
                                                        {getTimeAgo(notif.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-3 border-t bg-slate-50/50">
                            <Link
                                href="/inbox"
                                onClick={() => setShowNotifications(false)}
                                className="block text-center text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest py-2 hover:bg-white rounded-xl transition-colors"
                            >
                                View all in Inbox →
                            </Link>
                        </div>
                    </div>
                )}
            </div>


            {/* Go Pro — hidden on pricing page */}
            {!isPricing && (
                <Link
                    href="/pricing"
                    className="group relative flex items-center space-x-2 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest text-white shadow-lg overflow-hidden transition-all hover:shadow-xl hover:scale-105"
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
                        backgroundSize: '200% 200%',
                        animation: 'gradient-shift 3s ease infinite',
                    }}
                >
                    <Sparkles className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Go Pro</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
            )}

            {/* Gradient animation keyframes */}
            <style jsx>{`
                @keyframes gradient-shift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </div>
    );
}
