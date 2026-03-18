'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Zap,
  ArrowUpRight,
  Target,
  Clock,
  Sparkles,
  Plus,
  ArrowRight,
  Play,
  Pause,
  TrendingUp,
  Mail,
  Eye,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { GlowContainer } from '@/components/GlowBorder';
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
    replyRate: 0,
    dailyRemaining: 80,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.global) {
          setStats(data.global);
          setCampaigns(data.campaignPerformance || []);
          setHasActiveCampaigns(data.global.activeCampaigns > 0);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    'ACTIVE': { label: 'Running', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    'PAUSED': { label: 'Paused', color: 'text-amber-600', bg: 'bg-amber-500/10' },
    'DRAFT': { label: 'Draft', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    'COMPLETED': { label: 'Completed', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  };

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <GlowContainer active={hasActiveCampaigns} className="p-0 border-none bg-transparent">
        <div className="bg-background rounded-[inherit] overflow-hidden shadow-xl shadow-slate-200/50">
          <TopBar
            title="Dashboard"
            description="Track your campaign performance and manage high-intent leads."
            action={
              <div className="flex items-center space-x-3">
                <div className="px-3 py-1.5 bg-muted rounded-full flex items-center space-x-2 border border-border">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", hasActiveCampaigns ? "bg-emerald-500" : "bg-primary")} />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                    {hasActiveCampaigns ? 'Campaign Running' : 'Ready to Start'}
                  </span>
                </div>
                <Link href="/campaigns">
                  <button className="flex items-center space-x-2 bg-primary text-primary-foreground pl-4 pr-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:scale-95 group">
                    <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                    <span>New Campaign</span>
                  </button>
                </Link>
              </div>
            }
          />

          <div className="p-6 lg:p-10 space-y-10 lg:space-y-12">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Active Leads', value: stats.totalLeads.toLocaleString(), change: '+12.5%', icon: Users, color: 'text-primary' },
                { label: 'Sent Requests', value: stats.sentRequests.toLocaleString(), change: '+18.2%', icon: Target, color: 'text-emerald-500' },
                { label: 'Reply Rate', value: `${stats.replyRate}%`, change: '+4.3%', icon: Zap, color: 'text-amber-500' },
                { label: 'Daily Remaining', value: `${stats.dailyRemaining}/80`, change: '100%', icon: Clock, color: 'text-blue-500' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card p-6 rounded-[2.5rem] border border-border shadow-soft group hover:border-primary/20 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-3 rounded-2xl bg-muted", stat.color)}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-1 rounded-full",
                      stat.change.startsWith('+') ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                    )}>
                      {stat.change}
                    </span>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-foreground tracking-tight">{stat.value}</p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Campaign Performance Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-foreground tracking-tight">Campaign Performance</h3>
                  <Link href="/campaigns" className="flex items-center space-x-2 text-primary font-black text-xs uppercase tracking-widest hover:underline">
                    <span>View All</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="bg-card rounded-[3rem] border border-border shadow-soft p-16 text-center">
                    <div className="w-20 h-20 bg-muted rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                      <Target className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-black text-foreground">No Campaigns Yet</h3>
                    <p className="text-sm font-bold text-muted-foreground mt-2 max-w-sm mx-auto">
                      Create your first campaign to start reaching prospects and tracking performance.
                    </p>
                    <Link href="/campaigns">
                      <button className="mt-6 flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl text-sm font-black mx-auto shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                        <Plus className="w-4 h-4" />
                        <span>Create Campaign</span>
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaigns.slice(0, 5).map((campaign, i) => {
                      const config = statusConfig[campaign.status] || statusConfig['DRAFT'];

                      return (
                        <motion.div
                          key={campaign.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i }}
                          className="bg-card rounded-[2rem] border border-border shadow-soft p-6 hover:border-primary/20 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center space-x-4">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.bg)}>
                                {campaign.status === 'ACTIVE' ? (
                                  <Play className={cn("w-5 h-5", config.color)} />
                                ) : campaign.status === 'PAUSED' ? (
                                  <Pause className={cn("w-5 h-5", config.color)} />
                                ) : (
                                  <Target className={cn("w-5 h-5", config.color)} />
                                )}
                              </div>
                              <div>
                                <h4 className="font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{campaign.name}</h4>
                                <span className={cn("text-[10px] font-black uppercase tracking-widest", config.color)}>{config.label}</span>
                              </div>
                            </div>
                            <Link href={`/campaigns/${campaign.id}/builder`}>
                              <button className="px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary font-bold text-xs transition-all flex items-center space-x-2">
                                <span>View</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-muted/50 rounded-xl p-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5 mb-1">
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                              <p className="text-lg font-black text-foreground">{campaign.totalLeads}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Leads</p>
                            </div>
                            <div className="bg-muted/50 rounded-xl p-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5 mb-1">
                                <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                              </div>
                              <p className="text-lg font-black text-foreground">{campaign.pending}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pending</p>
                            </div>
                            <div className="bg-muted/50 rounded-xl p-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5 mb-1">
                                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                              <p className="text-lg font-black text-foreground">{campaign.connected}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Connected</p>
                            </div>
                            <div className="bg-muted/50 rounded-xl p-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5 mb-1">
                                <Mail className="w-3.5 h-3.5 text-blue-500" />
                              </div>
                              <p className="text-lg font-black text-foreground">{campaign.replied}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Replied</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-primary to-primary-foreground rounded-[3rem] p-10 text-primary-foreground relative overflow-hidden shadow-2xl shadow-primary/20">
                  <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/10" />
                  <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">Pro Tip</span>
                    <h3 className="text-2xl font-black mt-6 leading-tight">Increase your reply rate by 40%</h3>
                    <p className="text-sm font-medium mt-4 text-white/80 leading-relaxed">
                      Connect your profile to use &quot;Visit Before Invite&quot; automation. It increases trust and visibility.
                    </p>
                    <Link href="/pricing">
                      <button className="mt-8 flex items-center justify-between w-full bg-white text-primary px-8 py-4 rounded-[1.5rem] font-black group transition-all hover:scale-105 active:scale-95">
                        <span>Upgrade to advanced</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                      </button>
                    </Link>
                  </div>
                </div>

                <div className="bg-card rounded-[3rem] border border-border p-8 shadow-soft">
                  <h4 className="font-black text-muted-foreground uppercase tracking-widest text-[10px] mb-6 px-2">Quick Actions</h4>
                  <div className="space-y-3">
                    <Link href="/prospects" className="flex items-center space-x-4 p-4 hover:bg-muted rounded-2xl transition-all cursor-pointer group">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground">View Prospects</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Manage your leads</p>
                      </div>
                    </Link>
                    <Link href="/inbox" className="flex items-center space-x-4 p-4 hover:bg-muted rounded-2xl transition-all cursor-pointer group">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Mail className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground">Check Inbox</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Read messages</p>
                      </div>
                    </Link>
                    <Link href="/campaigns" className="flex items-center space-x-4 p-4 hover:bg-muted rounded-2xl transition-all cursor-pointer group">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground">Campaign Builder</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Create automations</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlowContainer>
    </div>
  );
}
