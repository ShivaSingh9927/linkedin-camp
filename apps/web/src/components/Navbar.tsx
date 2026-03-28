'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  Send, 
  Layers, 
  Settings, 
  PanelLeftClose, 
  Bell, 
  Search,
  ChevronDown,
  Sparkles,
  Inbox,
  LayoutDashboard,
  Target,
  LogOut,
  User,
  Ghost
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LinkedInConnectivity from './LinkedInConnectivity';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Campaigns', icon: Target, href: '/campaigns' },
  { label: 'Inbox', icon: Inbox, href: '/inbox' },
  { label: 'Prospects', icon: Users, href: '/prospects' },
  { label: 'Queue', icon: Layers, href: '/queue' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Pricing', icon: Sparkles, href: '/pricing' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const [showUserMenu, setShowUserMenu] = useState(false);
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
    <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50">
      <div className="flex items-center space-x-12">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-36 h-36 bg-primary/10 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10 group-hover:scale-105 transition-all duration-300 relative overflow-hidden">
            <img 
              src="/leadmate.png" 
              alt="Logo" 
              className="w-full h-full object-contain filter brightness-0 invert" 
            />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight leading-none block">LEADMATE</span>
            <span className="text-[10px] font-black text-primary tracking-[0.25em] uppercase mt-0.5 block">Automate</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          {navItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2",
                  isActive 
                    ? "bg-primary/5 text-primary" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-slate-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center space-x-6">
        <div className="hidden lg:flex relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search leads, campaigns..."
            className="pl-12 pr-6 py-2.5 bg-slate-100 border-none rounded-2xl text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>

        <div className="h-8 w-px bg-slate-100 mx-2" />

        <div className="flex items-center space-x-4">
          <LinkedInConnectivity />

          <button className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all relative group">
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce-slow">
                {notifications}
              </span>
            )}
          </button>

          <Link href="/settings" className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all">
            <Settings className="w-5 h-5" />
          </Link>

          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 p-1.5 pl-4 hover:bg-slate-50 rounded-2xl transition-all group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 leading-none">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">
                  {user?.tier || 'FREE'} PLAN
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl border-2 border-primary/20 p-0.5 group-hover:rotate-3 transition-transform">
                <div className="w-full h-full bg-slate-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showUserMenu && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 p-2"
                >
                  <div className="p-4 bg-slate-50 rounded-2xl mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Premium Goal</p>
                        <p className="text-[10px] font-bold text-slate-400">75% of goal reached</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full mt-3 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '75%' }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>

                  <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all text-sm font-bold group">
                    <Ghost className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    <span>Ghost Mode</span>
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm font-bold mt-1 group"
                  >
                    <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    <span>Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </header>
  );
}
