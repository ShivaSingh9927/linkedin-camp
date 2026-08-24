'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Users,
  Zap,
  Target,
  Clock,
  Plus,
  Play,
  Pause,
  Mail,
  Eye,
  UserPlus,
  Send,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { WelcomeReveal } from '@/components/WelcomeReveal';
import { ActivationHero, type SetupStatus } from '@/components/ActivationHero';
import { OptionalSetupReminder } from '@/components/OptionalSetupReminder';
import { StrategySummaryCard } from '@/components/StrategySummaryCard';
import { ActivationCopilot, ACTIVATION_DISMISSED_KEY } from '@/components/copilot/ActivationCopilot';
import { QampiDashboardPanel } from '@/components/copilot/QampiDashboardPanel';
import { Card, StatTile, Badge, SectionHeader, PageHeader, EmptyState, Skeleton, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface CampaignPerf {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
  pending: number;
  connected: number;
  replied: number;
}

const statusConfig: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' | 'info'; icon: typeof Play }> = {
  ACTIVE: { label: 'Running', tone: 'success', icon: Play },
  PAUSED: { label: 'Paused', tone: 'warning', icon: Pause },
  DRAFT: { label: 'Draft', tone: 'neutral', icon: Target },
  COMPLETED: { label: 'Completed', tone: 'info', icon: Target },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignPerf[]>([]);
  const [hasActiveCampaigns, setHasActiveCampaigns] = useState(false);
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

  const hasData = campaigns.length > 0;

  // First-run copilot: a freshly-connected user (State 2 ⇒ LinkedIn connected)
  // who hasn't imported a lead or made a campaign yet, and hasn't dismissed it.
  const showActivationCopilot =
    !!setup?.requiredDone && !loading && stats.totalLeads === 0 && campaigns.length === 0 && !copilotDismissed;

  // Every value is measured — no fabricated week-over-week deltas.
  const kpis = [
    { label: 'Active leads', value: stats.totalLeads.toLocaleString(), icon: Users, tone: 'brand' as const, sub: undefined as string | undefined },
    { label: 'Requests sent', value: stats.sentRequests.toLocaleString(), icon: Send, tone: 'success' as const, sub: undefined },
    { label: 'Connected', value: stats.connectedLeads.toLocaleString(), icon: Zap, tone: 'warning' as const, sub: undefined },
    { label: 'Invites left today', value: `${stats.dailyRemaining}`, icon: Clock, tone: 'info' as const, sub: `/${stats.caps?.invites ?? 18}` },
  ];

  // Only the caps LinkedIn actually enforces on the account, sourced from the
  // server (never hardcoded) — profile visits aren't daily-capped, so we don't
  // show a fabricated limit for them.
  const quotas = [
    { label: 'Invitations', value: stats.today?.invites || 0, total: stats.caps?.invites ?? 18, bar: 'bg-amber-500' },
    { label: 'Messages', value: stats.today?.messages || 0, total: stats.caps?.messages ?? 40, bar: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-7">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-card" />)}
          </div>
        </div>
      )}

      {/* State 2 — dashboard (required setup complete) */}
      {setup?.requiredDone && (
        <>
          <PageHeader
            title={firstName ? `${greeting()}, ${firstName}` : greeting()}
            subtitle={
              hasData
                ? "Here's how your outreach is performing today."
                : 'Launch your first campaign — real results appear here once it runs.'
            }
            actions={
              <Link href="/campaigns">
                <Button>
                  <Plus className="w-4 h-4" />
                  New Campaign
                </Button>
              </Link>
            }
          />

          {/* Optional setup reminder — dismissible top strip */}
          <OptionalSetupReminder status={setup} variant="strip" />

          {/* KPI grid — only when there's real activity */}
          {hasData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi, i) => (
                <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <StatTile icon={kpi.icon} value={kpi.value} label={kpi.label} sub={kpi.sub} tone={kpi.tone} compact />
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent campaigns */}
        <div className="lg:col-span-2 space-y-3">
          <SectionHeader
            title="Recent campaigns"
            action={hasData && <Link href="/campaigns" className="label !text-brand hover:underline">View all →</Link>}
          />

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          ) : !hasData ? (
            <EmptyState
              icon={Clock}
              title="No performance data yet"
              description="Once your first campaign sends, you'll see live connection and reply activity here — all measured, never estimated."
              action={
                <Link href="/campaigns">
                  <Button>
                    <Plus className="w-4 h-4" />
                    Create campaign
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 3).map((campaign, i) => {
                const config = statusConfig[campaign.status] || statusConfig.DRAFT;
                const Icon = config.icon;
                return (
                  <motion.div key={campaign.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                    <Card interactive className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn('w-9 h-9 rounded-control grid place-items-center shrink-0',
                            config.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : config.tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-surface text-ink-500')}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-foreground truncate">{campaign.name}</h4>
                            <Badge tone={config.tone} dot className="mt-0.5 !px-0 !bg-transparent">{config.label}</Badge>
                          </div>
                        </div>
                        <Link href={`/campaigns/${campaign.id}`}>
                          <Button variant="secondary" size="sm">View</Button>
                        </Link>
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-4">
                        {[
                          { v: campaign.totalLeads, k: 'Leads', c: '' },
                          { v: campaign.pending, k: 'Pending', c: 'text-amber-600' },
                          { v: campaign.connected, k: 'Connected', c: 'text-emerald-600' },
                          { v: campaign.replied, k: 'Replied', c: 'text-blue-600' },
                        ].map((m) => (
                          <div key={m.k} className="bg-surface rounded-control p-3 text-center">
                            <p className={cn('num text-[18px]', m.c)}>{m.v}</p>
                            <p className="label !text-[9px] mt-0.5">{m.k}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Qampi copilot (permanent) + usage */}
        <div className="space-y-3">
          <QampiDashboardPanel />

          <SectionHeader
            title="Today's usage"
            action={<Badge tone="success" dot>Active</Badge>}
          />
          <Card className="p-5 space-y-5">
            {quotas.map((q) => (
              <div key={q.label}>
                <div className="flex justify-between mb-2">
                  <span className="label">{q.label}</span>
                  <span className="num text-[12px] text-ink-500">{q.value}/{q.total}</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', q.bar)} style={{ width: `${Math.min(100, (q.value / q.total) * 100)}%` }} />
                </div>
              </div>
            ))}
            <p className="text-[12px] text-ink-500 font-medium pt-1">Safe daily limits keep your account healthy.</p>
            <Link href="/campaigns/queue">
              <Button variant="outline" className="w-full">Queue manager</Button>
            </Link>
          </Card>

          {/* AI strategy — compact rail card (matches mock) */}
          <StrategySummaryCard compact />

          {/* Optional setup — rail fallback (shows only after the strip is dismissed) */}
          <OptionalSetupReminder status={setup} variant="rail" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
