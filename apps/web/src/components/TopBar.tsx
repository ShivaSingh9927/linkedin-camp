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
} from 'lucide-react';

// Mock notifications
const MOCK_NOTIFICATIONS = [
    {
        id: '1',
        type: 'campaign_complete',
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-50',
        title: 'Campaign completed',
        body: '"LinkedIn Classic" finished processing all leads.',
        time: '2 min ago',
        read: false,
    },
    {
        id: '2',
        type: 'new_reply',
        icon: MessageSquare,
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-50',
        title: 'New reply from Sarah Conner',
        body: '"Hi! Thanks for reaching out. I\'d love to chat."',
        time: '15 min ago',
        read: false,
    },
    {
        id: '3',
        type: 'warning',
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-50',
        title: 'Daily limit approaching',
        body: 'You\'ve used 28/30 LinkedIn invites today.',
        time: '1 hr ago',
        read: true,
    },
    {
        id: '4',
        type: 'tip',
        icon: Target,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-50',
        title: '50 leads need attention',
        body: 'You have uninvited prospects. Start a campaign!',
        time: '3 hrs ago',
        read: true,
    },
];

export function TopBar() {
    const pathname = usePathname();
    const isPricing = pathname === '/pricing';
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return (
        <div className="flex items-center space-x-3">
            {/* Tokens */}
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-black text-slate-700">120</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">tokens</span>
            </div>

            {/* Notifications */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2.5 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                >
                    <Bell className="w-4 h-4 text-slate-500" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount}
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
                                        onClick={markAllRead}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[380px] overflow-y-auto divide-y">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.read ? 'bg-indigo-50/30' : ''
                                        }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className={`p-2 rounded-xl ${notif.iconBg} flex-shrink-0`}>
                                            <notif.icon className={`w-4 h-4 ${notif.iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2">
                                                <p className="text-sm font-bold text-slate-800">{notif.title}</p>
                                                {!notif.read && (
                                                    <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">{notif.body}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{notif.time}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t bg-slate-50/50">
                            <Link
                                href="/inbox"
                                onClick={() => setShowNotifications(false)}
                                className="block text-center text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest py-2 hover:bg-white rounded-xl transition-colors"
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
