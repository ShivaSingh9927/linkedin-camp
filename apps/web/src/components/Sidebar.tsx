'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  Layers, 
  Settings, 
  Send,
  Sparkles,
  Inbox,
  LayoutDashboard,
  Target,
  LogOut,
  ChevronRight,
  HelpCircle,
  Gem,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const menuItems = [
  { label: 'Workflows', icon: LayoutDashboard, href: '/' },
  { label: 'Campaigns', icon: Target, href: '/campaigns' },
  { label: 'Prospects', icon: Users, href: '/prospects' },
  { label: 'Inbox', icon: Inbox, href: '/inbox' },
  { label: 'Queue', icon: Layers, href: '/queue' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Pricing', icon: Sparkles, href: '/pricing' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="w-72 bg-white border-r border-slate-100 flex flex-col h-full sticky top-0 overflow-y-auto custom-scrollbar">
      {/* Brand */}
      <div className="p-8">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform">
            <Send className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">SALES</span>
            <span className="block text-[10px] font-black text-primary -mt-1 tracking-[0.3em] uppercase">BOT</span>
          </div>
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-4 space-y-1">
        <div className="px-4 mb-4">
          <button className="w-full flex items-center justify-center space-x-2 py-4 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-1 active:scale-95 group">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span>Create Campaign</span>
          </button>
        </div>

        {menuItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group font-bold text-sm",
                active 
                  ? "bg-primary text-white shadow-lg shadow-primary/15" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-primary"
              )}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-400 group-hover:text-primary")} />
                <span>{item.label}</span>
              </div>
              {active && <ChevronRight className="w-4 h-4 text-white/70" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer Nav */}
      <div className="p-4 space-y-4">
        {/* Pro Banner */}
        <div className="bg-slate-900 rounded-[32px] p-6 relative overflow-hidden group border border-white/10 shadow-2xl">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/40 transition-colors" />
          <div className="relative z-10">
            <div className="flex items-center space-x-2 text-primary">
              <Gem className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Upgrade</span>
            </div>
            <p className="text-sm font-bold text-white mt-1">Get 500% more leads</p>
            <Link 
              href="/pricing" 
              className="mt-4 w-full py-2.5 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center hover:bg-primary hover:text-white transition-all"
            >
              Upgrade Now
            </Link>
          </div>
        </div>

        <div className="px-2 space-y-1">
          <Link
            href="/settings"
            className={cn(
              "flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
              pathname === '/settings' ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 px-4 flex items-center justify-between">
          <button className="text-slate-400 hover:text-slate-600">
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
             <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Cloud</span>
          </div>
        </div>
      </div>
    </div>
  );
}
