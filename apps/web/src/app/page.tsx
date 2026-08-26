'use client';

import { useState, useEffect, Suspense } from 'react';
import { Users, Send, MessageSquare, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { WelcomeReveal } from '@/components/WelcomeReveal';
import { ActivationHero, type SetupStatus } from '@/components/ActivationHero';
import { OptionalSetupReminder } from '@/components/OptionalSetupReminder';
import { ActivationCopilot, ACTIVATION_DISMISSED_KEY } from '@/components/copilot/ActivationCopilot';
import { QampiDashboardPanel } from '@/components/copilot/QampiDashboardPanel';
import { DynamicStatusPanel, type StatusCampaign, type StatusLog } from '@/components/dashboard/DynamicStatusPanel';
import { Skeleton, Button } from '@/components/ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<StatusCampaign[]>([]);
  const [recentLogs, setRecentLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [stats, setStats] = useState({
    totalLeads: 0,
    sentRequests: 0,
    connectedLeads: 0,
    dailyRemaining: 18,
    caps: { invites: 18, messages: 40 },
    today: { invites: 0, messages: 0, visits: 0 },
  });
  const [copilotDismissed, setCopilotDismissed] = useState(true); // assume dismissed until we read localStorage (avoids a flash)

  useEffect(() => {
    try { setCopilotDismissed(localStorage.getItem(ACTIVATION_DISMISSED_KEY) === '1'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setFirstName((u?.name || '').split(/\s+/)[0] || '');
      }
    } catch { /* ignore */ }
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
          setRecentLogs(data.recentLogs || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // First-run copilot: a freshly-connected user (State 2 ⇒ LinkedIn connected)
  // who hasn't imported a lead or made a campaign yet, and hasn't dismissed it.
  const showActivationCopilot =
    !!setup?.requiredDone && !loading && stats.totalLeads === 0 && campaigns.length === 0 && !copilotDismissed;

  // Replies are the outcome that matters; derive the total from per-campaign
  // counts already in the payload (no extra query).
  const totalReplies = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);

  const kpis = [
    { label: 'Active leads', value: stats.totalLeads.toLocaleString(), icon: Users },
    { label: 'Requests sent', value: stats.sentRequests.toLocaleString(), icon: Send },
    { label: 'Replies', value: totalReplies.toLocaleString(), icon: MessageSquare },
  ];

  // Only the caps LinkedIn actually enforces, sourced from the server.
  const quotas = [
    { label: 'Invitations', value: stats.today?.invites || 0, total: stats.caps?.invites ?? 18, bar: 'bg-amber-500' },
    { label: 'Messages', value: stats.today?.messages || 0, total: stats.caps?.messages ?? 40, bar: 'bg-blue-500' },
  ];

  return (
    <>
      <Suspense fallback={null}>
        <WelcomeReveal />
      </Suspense>

      {/* First-run full-screen copilot takeover */}
      {showActivationCopilot && <ActivationCopilot onDismiss={() => setCopilotDismissed(true)} />}

      {/* State 1 — onboarding (renders full page while required setup is incomplete; null once done) */}
      <ActivationHero onResolved={setSetup} />

      {/* Brief loading while we resolve setup status */}
      {setup === null && (
        <div className="space-y-6">
          <Skeleton className="h-9 w-72 rounded-control" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-card" />)}
          </div>
          <Skeleton className="h-80 rounded-card" />
        </div>
      )}

      {/* State 2 — dashboard: a fixed one-window layout (no page scroll on lg;
          each pane scrolls internally). Falls back to natural stacked scroll on
          mobile. */}
      {setup?.requiredDone && (
        <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8.5rem)] lg:min-h-0">
          <div className="flex items-end justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold tracking-tight leading-none text-foreground truncate">
                {firstName ? `${greeting()}, ${firstName}` : greeting()}
              </h1>
              <p className="text-ink-500 font-medium mt-1.5 text-[13px]">Here&rsquo;s what&rsquo;s happening with your outreach.</p>
            </div>
            <Link href="/campaigns" className="shrink-0">
              <Button>
                <Plus className="w-4 h-4" />
                New Campaign
              </Button>
            </Link>
          </div>

          {/* Optional setup reminder — dismissible top strip */}
          <div className="shrink-0">
            <OptionalSetupReminder status={setup} variant="strip" />
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: KPIs + the Qampi conversation as the MAIN surface */}
            <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3 shrink-0">
                {kpis.map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-card border border-line rounded-card p-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-control bg-brand-50 grid place-items-center shrink-0">
                        <kpi.icon className="w-4 h-4 text-brand" />
                      </div>
                      <span className="text-[12px] text-ink-500 truncate">{kpi.label}</span>
                    </div>
                    <p className="num text-[26px] leading-none mt-3">{kpi.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* The copilot — the big conversation surface */}
              <div className="flex-1 min-h-[360px] lg:min-h-0">
                <QampiDashboardPanel />
              </div>
            </div>

            {/* Right: status → replies → today's limits → recent activity */}
            <div className="min-h-0">
              <DynamicStatusPanel campaigns={campaigns} logs={recentLogs} setup={setup} loading={loading} quotas={quotas} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
