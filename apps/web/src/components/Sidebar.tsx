'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Users,
  Inbox,
  LayoutDashboard,
  Target,
  Gem,
  Plus,
  Building2,
  Sparkles,
  UsersRound,
  BellRing,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'AI Profile', icon: Sparkles, href: '/settings/ai-profile' },
  { label: 'Campaigns', icon: Target, href: '/campaigns' },
  { label: 'Prospects', icon: Users, href: '/prospects' },
  { label: 'Companies', icon: Building2, href: '/companies' },
  { label: 'Inbox', icon: Inbox, href: '/inbox' },
  { label: 'Follow-ups', icon: BellRing, href: '/campaigns/queue', badgeKey: 'followups' },
  { label: 'Crew', icon: UsersRound, href: '/team' },
  { label: 'Pricing', icon: Sparkles, href: '/pricing' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [followUpCount, setFollowUpCount] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    // Light poll for the follow-up badge (leads waiting on another touch).
    api.get('/leads/follow-ups')
      .then((res) => setFollowUpCount(res.data?.counts?.total || 0))
      .catch(() => { /* badge is best-effort */ });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const initials = (user?.name || user?.email || 'Q')
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="w-64 bg-white border-r border-line flex flex-col h-full sticky top-0 overflow-y-auto">
      {/* Brand */}
      <div className="px-6 py-6">
        <Link href="/" className="flex items-center gap-3 group">
          <img src="/qampi_wbg.png" alt="Qampi" className="w-9 h-9 object-contain group-hover:scale-105 transition-transform" />
          <div>
            <span className="font-bold tracking-tight leading-none block text-foreground">Qampi</span>
            <span className="label !text-[9px] !tracking-[0.22em] !text-brand mt-1 block">LinkedIn Autopilot</span>
          </div>
        </Link>
      </div>

      {/* Create */}
      <div className="px-4">
        <Link
          href="/campaigns"
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand text-white rounded-control font-semibold text-[13px] shadow-lift hover:bg-brand-600 transition-all active:scale-[.98] group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          <span>New Campaign</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-3 mt-5 space-y-0.5 flex-1">
        {menuItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-control transition-all font-semibold text-[13px]',
                active ? 'bg-brand text-white shadow-lift' : 'text-ink-500 hover:bg-surface hover:text-foreground',
              )}
            >
              <item.icon className={cn('w-[18px] h-[18px]', active ? 'text-white' : 'text-ink-400')} />
              <span>{item.label}</span>
              {item.badgeKey === 'followups' && followUpCount > 0 && (
                <span className={cn(
                  'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  active ? 'bg-white/20 text-white' : 'bg-brand/10 text-brand',
                )}>
                  {followUpCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-3">
        <div className="rounded-card bg-ink-900 text-white p-4 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-brand/40 blur-2xl" />
          <div className="relative z-10">
            <div className="label !text-brand-200 flex items-center gap-1.5">
              <Gem className="w-3 h-3" /> Upgrade
            </div>
            <p className="text-[13px] font-semibold mt-1">Unlock unlimited campaigns</p>
            <Link
              href="/pricing"
              className="mt-3 w-full py-2 bg-white text-ink-900 rounded-chip text-[12px] font-semibold flex items-center justify-center hover:bg-brand-50 transition-colors"
            >
              See plans
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-2 py-2 rounded-control hover:bg-surface transition-colors">
          <Link href="/settings" className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand grid place-items-center text-[12px] font-bold shrink-0">
              {initials || 'Q'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate text-foreground">{user?.name || 'Your account'}</div>
              <div className="text-[11px] font-medium text-ink-400 truncate">{user?.email || 'Settings'}</div>
            </div>
          </Link>
          <button onClick={handleLogout} title="Sign out" className="text-ink-400 hover:text-ink-700 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
