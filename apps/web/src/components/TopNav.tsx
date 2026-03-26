'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Menu,
    X,
    LayoutDashboard,
    Target,
    Users,
    Inbox as InboxIcon,
    Layers,
    Sparkles,
    Settings,
    LogOut,
    ChevronDown,
    Search,
    Bell,
    User,
    Plus,
    Zap,
    Ghost,
    Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import LinkedInConnectivity from './LinkedInConnectivity';

const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    {
        label: 'Campaigns',
        icon: Target,
        href: '/campaigns',
        items: [
            { label: 'My Campaigns', href: '/campaigns', icon: Target },
            { label: 'Prebuilt Campaigns', href: '/campaigns', icon: Package },
            { label: 'Execution Queue', href: '/queue', icon: Layers },
        ]
    },
    { label: 'Prospects', icon: Users, href: '/prospects' },
    { label: 'Inbox', icon: InboxIcon, href: '/inbox' },
    { label: 'Crew', icon: Users, href: '/team' },
    { label: 'Pricing', icon: Sparkles, href: '/pricing' },
];

export function TopNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) setUser(JSON.parse(userData));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="w-full px-6 lg:px-10 h-20 flex items-center justify-between relative">
                {/* Left Side: Brand */}
                <Link href="/" className="flex items-center space-x-4 flex-shrink-0 group">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/10 group-hover:scale-105 transition-all duration-300">
                        <img 
                            src="/leadmate.jpeg" 
                            alt="LEADMATE" 
                            className="w-full h-full rounded-2xl object-cover p-1" 
                        />
                    </div>
                    <div className="hidden sm:block">
                        <span className="text-2xl font-black text-foreground tracking-tight leading-none block">LEADMATE</span>
                        <span className="text-[10px] font-black text-primary tracking-[0.3em] uppercase mt-1 block">AI Outreach</span>
                    </div>
                </Link>

                {/* Center: Desktop Nav */}
                <nav className="hidden lg:flex items-center space-x-1 absolute left-1/2 -translate-x-1/2">
                    {menuItems.map((item) => {
                        const active = pathname === item.href || (item.items?.some(sub => pathname === sub.href));

                        if (item.items) {
                            return (
                                <div
                                    key={item.label}
                                    className="relative"
                                    onMouseEnter={() => setActiveDropdown(item.label)}
                                    onMouseLeave={() => setActiveDropdown(null)}
                                >
                                    <button
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2",
                                            active
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        <span>{item.label}</span>
                                        <ChevronDown className={cn("w-3 h-3 transition-transform", activeDropdown === item.label && "rotate-180")} />
                                    </button>

                                    <AnimatePresence>
                                        {activeDropdown === item.label && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute top-full left-0 mt-2 w-64 bg-background border border-border rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                                            >
                                                {item.items.map((subItem: any) => (
                                                    <Link
                                                        key={subItem.label}
                                                        href={subItem.href}
                                                        className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                            <subItem.icon className="w-4 h-4" />
                                                        </div>
                                                        <span>{subItem.label}</span>
                                                    </Link>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2",
                                    pathname === item.href
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Right Side: Search, Connectivity, Actions */}
                <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
                    {/* Search
                    <div className="hidden xl:flex relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search leads..."
                            className="pl-11 pr-4 py-2 bg-muted border-none rounded-2xl text-xs w-40 focus:w-64 focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-muted-foreground/60"
                        />
                    </div> */}

                    <div className="h-6 w-px bg-border mx-2 hidden sm:block" />

                    {/* Connectivity */}
                    <LinkedInConnectivity />

                    {/* Actions */}
                    <div className="flex items-center space-x-1">
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={cn(
                                    "p-2 rounded-xl transition-all relative",
                                    showNotifications ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                                )}
                            >
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
                            </button>

                            <AnimatePresence>
                                {showNotifications && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                            className="absolute top-full right-0 mt-3 w-80 bg-background border border-border rounded-[2rem] shadow-2xl z-50 overflow-hidden"
                                        >
                                            <div className="p-6 border-b border-border bg-muted/5">
                                                <h3 className="font-black text-foreground">Notifications</h3>
                                            </div>
                                            <div className="max-h-96 overflow-y-auto p-2">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="flex items-start space-x-4 p-4 hover:bg-muted rounded-2xl transition-all cursor-pointer group">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                                                            <Users className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-foreground">Campaign Update</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">32 new prospects were synced to your campaign.</p>
                                                            <p className="text-[10px] font-black text-primary uppercase mt-2 tracking-wider">2 hours ago</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-4 bg-muted/30 border-t border-border">
                                                <button className="w-full py-3 bg-white border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                                                    Mark all as read
                                                </button>
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        <Button variant="ghost" size="icon" asChild className="rounded-xl hidden sm:flex">
                            <Link href="/settings">
                                <Settings className="w-5 h-5 text-muted-foreground" />
                            </Link>
                        </Button>
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center space-x-2 p-1 pl-3 hover:bg-muted rounded-2xl transition-all group border border-transparent hover:border-border"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-black text-foreground leading-none">
                                    {user?.email?.split('@')[0] || 'User'}
                                </p>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">
                                    {user?.tier || 'FREE'}
                                </p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                                <User className="w-5 h-5" />
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showUserMenu && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {showUserMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute top-full right-0 mt-3 w-64 bg-background rounded-3xl shadow-2xl border border-border overflow-hidden z-50 p-2"
                                >
                                    <div className="p-4 bg-muted/50 rounded-2xl mb-2">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                                <Zap className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-foreground">Usage Summary</p>
                                                <p className="text-[10px] font-bold text-muted-foreground">75% of limit used</p>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: '75%' }}
                                                className="h-full bg-primary"
                                            />
                                        </div>
                                    </div>

                                    <button className="w-full flex items-center space-x-3 px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-all text-sm font-bold group">
                                        <Ghost className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        <span>Ghost Architecture</span>
                                    </button>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center space-x-3 px-4 py-3 text-destructive hover:bg-destructive/5 rounded-xl transition-all text-sm font-bold mt-1 group"
                                    >
                                        <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        <span>Sign Out</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="lg:hidden border-t border-border overflow-hidden bg-background"
                    >
                        <div className="container mx-auto px-4 py-6 space-y-2">
                            {menuItems.map((item) => (
                                <div key={item.label}>
                                    {item.items ? (
                                        <div className="space-y-1">
                                            <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.label}</div>
                                            {item.items.map(sub => (
                                                <Link
                                                    key={sub.label}
                                                    href={sub.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
                                                        pathname === sub.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                                    )}
                                                >
                                                    <sub.icon className="w-5 h-5" />
                                                    <span>{sub.label}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={cn(
                                                "flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
                                                pathname === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            <span>{item.label}</span>
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
