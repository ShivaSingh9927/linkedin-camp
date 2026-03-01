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
} from "lucide-react";
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PREBUILT_TEMPLATES } from '@/lib/prebuilt-templates';
import { CampaignNameModal } from '@/components/CampaignNameModal';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      alert('Error creating campaign. Make sure the backend is running.');
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  const statCards = [
    { name: 'Total Leads', value: stats?.totalLeads || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Active Campaigns', value: stats?.activeCampaigns || 0, icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Successful Actions', value: stats?.successfulActions || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Weekly Growth', value: '+12%', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  // Show top 3 templates for Quick Start
  const quickStartTemplates = PREBUILT_TEMPLATES.slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Hello, Shiva</h1>
        <p className="text-slate-500 font-medium">Your outreach engine performance at a glance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{stat.name}</p>
              <p className="text-3xl font-black text-slate-900">{stat.value}</p>
            </div>
            <div className="absolute top-4 right-4 text-slate-200">
              <ArrowUpRight className="w-8 h-8 opacity-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start Templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Rocket className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Quick Start</h2>
          </div>
          <Link
            href="/campaigns/templates-gallery"
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 transition-colors"
          >
            <span>View all templates</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickStartTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all overflow-hidden group cursor-pointer"
              onClick={() => handleUseTemplate(tpl)}
            >
              <div className={`h-2 bg-gradient-to-r ${tpl.color}`} />
              <div className="p-6 space-y-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{tpl.icon}</span>
                  <div>
                    <p className="font-black text-slate-800 uppercase tracking-tight text-sm">{tpl.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tpl.category}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{tpl.description}</p>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.nodes.length - 1} steps</span>
                  <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.nodes.filter(n => n.data.subType === 'WAIT').length} delays</span>
                </div>
                <button className="w-full mt-2 py-2.5 bg-indigo-50 text-indigo-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                  Use This Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Recent Engine Activity</h3>
            </div>
            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest">Live Updates</button>
          </div>
          <div className="p-0 flex-1">
            {stats?.recentLogs?.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic font-medium">No activity reported yet. Start a campaign to see logs.</div>
            ) : (
              <div className="divide-y">
                {stats?.recentLogs?.map((log: any) => (
                  <div key={log.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tight">
                          {log.actionType.replace('_', ' ')}: <span className="text-indigo-600">{log.lead?.firstName} {log.lead?.lastName}</span>
                        </p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {new Date(log.executedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Completed
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Info */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-8 relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-4 italic">Next Step Guidance</h3>
            <p className="text-indigo-200/80 leading-relaxed font-medium">Use the <span className="text-white font-bold underline">LinkedIn Extension</span> to import more leads or tweak your workflow in the builder to add longer delays for safer outreach.</p>
          </div>
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-3 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
              <Clock className="w-6 h-6 text-indigo-300" />
              <div>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Auto-Pulse Active</p>
                <p className="text-sm font-bold">Engine checking for tasks...</p>
              </div>
            </div>
          </div>
          <Send className="absolute -bottom-10 -right-10 w-48 h-48 opacity-5 text-white transform group-hover:scale-110 transition-transform duration-700" />
        </div>
      </div>

      {/* Campaign Name Modal */}
      <CampaignNameModal
        isOpen={!!pendingTemplate}
        defaultName={pendingTemplate?.name || 'New Campaign'}
        onConfirm={handleConfirmCreate}
        onCancel={() => setPendingTemplate(null)}
      />
    </div>
  );
}
