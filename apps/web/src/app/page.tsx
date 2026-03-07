"use client";

import { useState, useEffect } from 'react';
import {
  Users,
  Send,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Loader2,
  Activity,
  Rocket,
  ArrowRight,
  MessageSquare,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PREBUILT_TEMPLATES } from '@/lib/prebuilt-templates';
import { CampaignNameModal } from '@/components/CampaignNameModal';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<typeof PREBUILT_TEMPLATES[0] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.post('/inbox/sync');
      // Refetch stats after a delay
      setTimeout(async () => {
        const res = await api.get('/stats');
        setStats(res.data);
        setIsSyncing(false);
      }, 5000);
    } catch (err) {
      console.error('Sync failed:', err);
      setIsSyncing(false);
    }
  };

  const handleUseTemplate = (template: typeof PREBUILT_TEMPLATES[0]) => {
    setPendingTemplate(template);
  };

  const handleConfirmCreate = async (name: string) => {
    if (!pendingTemplate) return;
    const template = pendingTemplate;
    setPendingTemplate(null);
    try {
      const workflowJson = {
        nodes: template.nodes.map(n => ({
          id: n.id,
          type: n.data?.type || 'TRIGGER',
          subType: n.data?.subType || 'START',
          data: n.data || {},
          position: n.position,
        })),
        edges: template.edges,
      };
      const res = await api.post('/campaigns', { name, workflowJson });
      router.push(`/campaigns/${res.data.id}/builder`);
    } catch (err) {
      console.error('Failed to create campaign from template:', err);
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  const mainStats = [
    { name: 'Total Leads', value: stats?.totalLeads || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Active Campaigns', value: stats?.activeCampaigns || 0, icon: Rocket, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Invites Sent', value: stats?.invitesSent || 0, icon: Send, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Connections', value: stats?.connectedLeads || 0, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const secondaryStats = [
    { name: 'Messages Sent', value: stats?.messagesSent || 0, icon: MessageSquare, color: 'text-violet-600' },
    { name: 'Total Actions', value: stats?.successfulActions || 0, icon: Zap, color: 'text-rose-600' },
  ];

  const chartData = stats?.chartData?.map((d: any) => ({
    name: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    actions: d.count
  })) || [];

  return (
    <div className="space-y-8 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none uppercase italic">Dashboard</h1>
          <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Engine is syncing at {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest hover:border-indigo-600 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {isSyncing ? 'Syncing...' : 'Sync Inbox'}
          </button>
          <Link href="/leads/import" className="px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest hover:border-indigo-600 transition-all">
            Import Leads
          </Link>
          <button onClick={() => setPendingTemplate(PREBUILT_TEMPLATES[0])} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-all">
            Launch Rapid Setup
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStats.map((stat) => (
          <div key={stat.name} className="group bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 relative overflow-hidden">
            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} w-fit mb-4 group-hover:scale-110 transition-transform duration-500`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.name}</p>
              <p className="text-3xl font-black text-slate-900 tabular-nums">{stat.value}</p>
            </div>
            <ArrowUpRight className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-50 group-hover:text-indigo-50 transition-colors duration-500" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Outreach Pulse (7d)</h3>
            </div>
            <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              Real-time
            </div>
          </div>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: '20px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="actions"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Leaderboard */}
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black uppercase tracking-tighter italic">Top Campaigns</h3>
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-6 flex-1">
              {stats?.campaignPerformance?.slice(0, 4).map((c: any) => (
                <div key={c.id} className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold truncate max-w-[150px] uppercase tracking-wider">{c.name}</span>
                    <span className="font-black text-indigo-400 tabular-nums">{c.actions} actions</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (c.actions / (stats.successfulActions || 1)) * 300)}%` }} />
                  </div>
                </div>
              ))}
              {(!stats?.campaignPerformance || stats?.campaignPerformance.length === 0) && (
                <div className="text-slate-500 uppercase text-[10px] font-black tracking-widest text-center mt-20">No campaigns launched</div>
              )}
            </div>

            <Link href="/campaigns" className="mt-8 group flex items-center justify-between bg-white text-slate-900 p-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
              Manage Campaigns
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <Zap className="absolute -top-10 -left-10 w-40 h-40 opacity-5 text-white transform -rotate-45" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        {/* Live Activity Log */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Engine Heartbeat</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latest successful operations</p>
              </div>
            </div>
          </div>
          <div className="divide-y-2 divide-slate-50 max-h-[400px] overflow-y-auto">
            {stats?.recentLogs?.map((log: any) => (
              <div key={log.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-center space-x-4">
                  <div className="bg-slate-50 text-slate-400 p-3 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    {log.actionType === 'INVITE' ? <Send className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm uppercase tracking-tight">
                      {log.actionType}: <span className="text-indigo-600">{log.lead?.firstName} {log.lead?.lastName}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {new Date(log.executedAt).toLocaleTimeString()} • COMPLETED
                    </p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/leads/${log.leadId}`} className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
            {stats?.recentLogs?.length === 0 && (
              <div className="p-12 text-center text-slate-300 uppercase text-xs font-black tracking-[0.2em]">Awaiting first actions...</div>
            )}
          </div>
        </div>

        {/* Stats breakdown */}
        <div className="space-y-6">
          {secondaryStats.map(s => (
            <div key={s.name} className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm flex items-center justify-between group hover:border-rose-100 transition-all">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.name}</p>
                <p className="text-2xl font-black text-slate-900 tabular-nums">{s.value}</p>
              </div>
              <div className={`p-4 rounded-2xl bg-slate-50 ${s.color} group-hover:scale-110 transition-transform`}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          ))}

          <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 group relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="text-sm font-black uppercase tracking-widest mb-2 opacity-80 italic">Pro Tip</h4>
              <p className="text-xs font-bold leading-relaxed">
                Accounts with <span className="underline underline-offset-4 decoration-2">AI Personalization</span> enabled see 40% higher connection rates.
              </p>
              <Link href="/settings" className="mt-4 flex items-center text-[10px] font-black uppercase tracking-[0.2em] group-hover:gap-4 gap-2 transition-all">
                Configure AI <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <TrendingUp className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10" />
          </div>
        </div>
      </div>

      <CampaignNameModal
        isOpen={!!pendingTemplate}
        defaultName={pendingTemplate?.name || 'New Campaign'}
        onConfirm={handleConfirmCreate}
        onCancel={() => setPendingTemplate(null)}
      />
    </div>
  );
}
