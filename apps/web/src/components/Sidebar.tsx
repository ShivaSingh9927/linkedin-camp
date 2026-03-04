"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Rocket,
    MessageSquare,
    UsersRound,
    Settings,
    Crown,
    LogOut,
    ChevronRight,
    FileText,
    ListOrdered,
    Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState } from 'react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const mainMenuItems = [
    { icon: LayoutDashboard, label: 'Home', href: '/' },
    { icon: Users, label: 'Prospects', href: '/leads' },
    {
        icon: Rocket, label: 'Campaigns', href: '/campaigns',
        submenu: [
            { icon: Rocket, label: 'Campaign List', href: '/campaigns' },
            { icon: Sparkles, label: 'Templates', href: '/campaigns/templates' },
            { icon: ListOrdered, label: 'Queue', href: '/campaigns/queue' },
        ],
    },
    { icon: MessageSquare, label: 'Inbox', href: '/inbox' },
    { icon: UsersRound, label: 'Crew', href: '/team' },
];

const bottomMenuItems = [
    { icon: Crown, label: 'Pricing', href: '/pricing' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [campaignsOpen, setCampaignsOpen] = useState(
        pathname.startsWith('/campaigns')
    );

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <div className="w-64 border-r bg-white h-screen flex flex-col">
            {/* Brand */}
            <div className="p-6 border-b">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Waalaxy Clone
                </h1>
            </div>

            {/* Main Nav */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {mainMenuItems.map((item) => {
                    const active = isActive(item.href);

                    if (item.submenu) {
                        return (
                            <div key={item.href}>
                                <button
                                    onClick={() => setCampaignsOpen(!campaignsOpen)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                                        active
                                            ? "bg-indigo-50 text-indigo-700"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    )}
                                >
                                    <div className="flex items-center space-x-3">
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-semibold text-sm">{item.label}</span>
                                    </div>
                                    <ChevronRight className={cn(
                                        "w-4 h-4 transition-transform",
                                        campaignsOpen && "rotate-90"
                                    )} />
                                </button>

                                {campaignsOpen && (
                                    <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                                        {item.submenu.map((sub) => {
                                            const subActive = pathname === sub.href;
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                                                        subActive
                                                            ? "bg-white shadow-sm text-indigo-700 font-bold border-l-2 border-indigo-600 -ml-[15px] pl-[17px]"
                                                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <sub.icon className="w-4 h-4" />
                                                    <span>{sub.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                                active
                                    ? "bg-indigo-50 text-indigo-700 font-bold shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-semibold text-sm">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t space-y-1">
                {bottomMenuItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                                active
                                    ? "bg-indigo-50 text-indigo-700 font-bold"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-semibold text-sm">{item.label}</span>
                        </Link>
                    );
                })}

                {/* User profile */}
                <div className="flex items-center space-x-3 px-3 py-2 bg-slate-50 rounded-lg mt-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        S
                    </div>
                    <div className="flex-1 truncate">
                        <p className="text-sm font-semibold text-slate-700">Shiva</p>
                        <p className="text-xs text-slate-400 truncate">shiva@example.com</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-all font-medium text-sm"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Log Out</span>
                </button>
            </div>
        </div>
    );
}
