'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Users,
  Zap,
  ArrowUpRight,
  Target,
  Clock,
  Plus,
  Play,
  Pause,
  Mail,
  Eye,
  UserPlus,
  Send,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GlowContainer } from '@/components/GlowBorder';
import { WelcomeReveal } from '@/components/WelcomeReveal';
import { ActivationHero } from '@/components/ActivationHero';
import { StrategySummaryCard } from '@/components/StrategySummaryCard';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CampaignPerf {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
  pending: number;
  connected: number;
  replied: number;
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignPerf[]>([]);
  const [hasActiveCampaigns, setHasActiveCampaigns] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    sentRequests: 0,
    connectedLeads: 0,
    dailyRemaining: 80,
    today: { invites: 0, messages: 0, visits: 0 },
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.global) {
          setStats(data.global);
          setCampaigns(data.campaignPerformance || []);
          setHasActiveCampaigns(data.global.activeCampaigns > 0);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Running', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    PAUSED: { label: 'Paused', color: 'text-amber-600', bg: 'bg-amber-500/10' },
    DRAFT: { label: 'Draft', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    COMPLETED: { label: 'Completed', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  };

  const hasData = campaigns.length > 0;

  // KPI cards — every value is measured. No fabricated deltas: we don't have
  // week-over-week data, so we show the real number and (where it exists) a
  // real secondary like the daily-cap ratio, never an invented "+12.5%".
  const kpis = [
    { label: 'Active Leads', value: stats.totalLeads.toLocaleString(), icon: Users, color: 'text-primary', bg: 'bg-primary/10', sub: null as string | null },
    { label: 'Sent Requests', value: stats.sentRequests.toLocaleString(), icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10', sub: null },
    { label: 'Connected', value: stats.connectedLeads.toLocaleString(), icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', sub: null },
    { label: 'Daily Remaining', value: `${stats.dailyRemaining}`, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', sub: `of 80` },
  ];

  const quotas = [
    { label: 'Invitations', value: stats.today?.invites || 0, total: 30, icon: UserPlus, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Messages', value: stats.today?.messages || 0, total: 50, icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Profile visits', value: stats.today?.visits || 0, total: 80, icon: Eye, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <Suspense fallback={null}>
        <WelcomeReveal />
      </Suspense>

      {/* Title on top */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl sm:text-[2.5rem] font-black text-foreground tracking-tight leading-none">Dashboard</h1>
          <p className="mt-3 text-[15px] sm:text-base font-medium text-muted-foreground">
            {hasData
              ? 'Track your campaign performance and manage high-intent leads.'
              : 'Finish setup to launch your first campaign — real results appear here once it runs.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="px-3 py-1.5 bg-muted rounded-full flex items-center gap-2 border border-border">
            <div className={cn('w-2 h-2 rounded-full animate-pulse', hasActiveCampaigns ? 'bg-emerald-500' : 'bg-primary')} />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              {hasActiveCampaigns ? 'Campaign Running' : 'Ready to Start'}
            </span>
          </div>
          <Link href="/campaigns">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground pl-4 pr-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:scale-95 group">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              <span>New Campaign</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Compact strategy summary (replaces the old hero + purple command center) */}
      <StrategySummaryCard />

      {/* Activation hero — self-hides once all four setup steps are done */}
      <ActivationHero />

      {/* KPI grid — only when there's real activity to report */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card p-5 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] border border-border shadow-soft"
            >
              <div className={cn('w-11 h-11 rounded-2xl bg-muted flex items-center justify-center mb-5', kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <p className="text-3xl sm:text-[2.25rem] font-black text-foreground tracking-tight leading-none">
                {kpi.value}
                {kpi.sub && <span className="text-base font-bold text-muted-foreground ml-1.5">{kpi.sub}</span>}
              </p>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2.5">{kpi.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Performance + capacity */}
      <GlowContainer active={hasActiveCampaigns} className="p-0 border-none bg-transparent">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left: campaign performance / empty state */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xl font-black text-foreground tracking-tight">Recent Campaigns</h3>
              {hasData && (
                <Link href="/campaigns" className="flex items-center gap-2 text-primary font-black text-[10px] sm:text-xs uppercase tracking-widest hover:underline">
                  <span>View All</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 bg-card rounded-[2rem] border border-border shadow-soft">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : !hasData ? (
              <div className="bg-card rounded-[2rem] sm:rounded-[2.5rem] border border-border shadow-soft p-12 sm:p-16 text-center">
                <div className="w-16 h-16 bg-muted rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 text-muted-foreground">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-foreground">No performance data yet</h3>
                <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                  Once your first campaign sends, you&apos;ll see live reply rates, sent requests and lead activity here — all measured, never estimated.
                </p>
                <Link href="/campaigns">
                  <button className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Create Campaign</span>
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.slice(0, 3).map((campaign, i) => {
                  const config = statusConfig[campaign.status] || statusConfig['DRAFT'];
                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="bg-card rounded-[1.5rem] sm:rounded-[2rem] border border-border shadow-soft p-5 sm:p-6 hover:border-primary/20 transition-all group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-4">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.bg)}>
                            {campaign.status === 'ACTIVE' ? <Play className={cn('w-5 h-5', config.color)} /> : campaign.status === 'PAUSED' ? <Pause className={cn('w-5 h-5', config.color)} /> : <Target className={cn('w-5 h-5', config.color)} />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-foreground tracking-tight group-hover:text-primary transition-colors truncate">{campaign.name}</h4>
                            <span className={cn('text-[10px] font-black uppercase tracking-widest', config.color)}>{config.label}</span>
                          </div>
                        </div>
                        <Link href={`/campaigns/${campaign.id}/builder`} className="w-full sm:w-auto">
                          <button className="w-full sm:w-auto px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary font-bold text-xs transition-all flex items-center justify-center sm:justify-start gap-2">
                            <span>View</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {[
                          { icon: Users, c: 'text-muted-foreground', v: campaign.totalLeads, k: 'Leads' },
                          { icon: UserPlus, c: 'text-amber-500', v: campaign.pending, k: 'Pending' },
                          { icon: Eye, c: 'text-emerald-500', v: campaign.connected, k: 'Connected' },
                          { icon: Mail, c: 'text-blue-500', v: campaign.replied, k: 'Replied' },
                        ].map((m) => (
                          <div key={m.k} className="bg-muted/50 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center mb-1"><m.icon className={cn('w-3.5 h-3.5', m.c)} /></div>
                            <p className="text-base sm:text-lg font-black text-foreground">{m.v}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{m.k}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: capacity / usage */}
          <div className="space-y-6">
            <div className="bg-card rounded-[2rem] sm:rounded-[2.5rem] border border-border p-6 sm:p-8 shadow-soft">
              <div className="flex items-center justify-between mb-6 px-1">
                <h4 className="font-black text-muted-foreground uppercase tracking-widest text-[10px]">{hasData ? "Today's usage" : "Today's capacity"}</h4>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{hasData ? 'Processing' : 'Ready'}</span>
                </div>
              </div>
              <div className="space-y-5">
                {quotas.map((q) => (
                  <div key={q.label}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg', q.bg)}><q.icon className={cn('w-3.5 h-3.5', q.color)} /></div>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{q.label}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 tracking-widest">{q.value}/{q.total}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-1000', q.color.replace('text', 'bg'))} style={{ width: `${(q.value / q.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-5">Safe daily limits to keep your LinkedIn account healthy.</p>
              <Link href="/campaigns/queue">
                <button className="w-full mt-5 py-3 border border-border rounded-xl text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-primary transition-all">
                  Advanced Queue Manager
                </button>
              </Link>
            </div>
          </div>
        </div>
      </GlowContainer>
    </div>
  );
}
