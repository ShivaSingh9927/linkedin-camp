'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WelcomeReveal } from '@/components/WelcomeReveal';
import { ActivationHero, type SetupStatus } from '@/components/ActivationHero';
import { OptionalSetupReminder } from '@/components/OptionalSetupReminder';
import { ProfileCompletionNudge } from '@/components/ProfileCompletionNudge';
import { ActivationCopilot, ACTIVATION_DISMISSED_KEY } from '@/components/copilot/ActivationCopilot';
import { FirstRunWorkspaceGuide } from '@/components/FirstRunWorkspaceGuide';
import { QampiDashboardPanel } from '@/components/copilot/QampiDashboardPanel';
import { type StatusCampaign, type StatusLog } from '@/components/dashboard/DynamicStatusPanel';
import { DashboardContextPanel } from '@/components/dashboard/DashboardContextPanel';
import { Skeleton } from '@/components/ui';

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<StatusCampaign[]>([]);
  const [recentLogs, setRecentLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
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
    { label: 'Active leads', value: stats.totalLeads.toLocaleString(), detail: `${campaigns.filter((c) => c.status === 'ACTIVE').length} live campaigns` },
    { label: 'Requests sent', value: stats.sentRequests.toLocaleString(), detail: 'Across all campaigns' },
    { label: 'Replies', value: totalReplies.toLocaleString(), detail: 'Needs your attention' },
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

      {/* First-run guide precedes the old copilot takeover only after the new
          onboarding handoff. Existing eligible users retain the copilot path. */}
      <Suspense fallback={null}>
        <FirstRunExperience
          showActivationCopilot={showActivationCopilot}
          onDismissCopilot={() => setCopilotDismissed(true)}
        />
      </Suspense>

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
        <div className="flex flex-col gap-4 lg:h-[calc(100dvh-6.5rem)] lg:min-h-0">
          {/* Complete-your-AI-profile nudge (profile/strategy quality) then the
              optional CRM/email reminder — both dismissible top strips. */}
          <div className="shrink-0 space-y-3">
            <ProfileCompletionNudge status={setup} />
            <OptionalSetupReminder status={setup} variant="strip" />
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(390px,2fr)]">
            {/* The copilot is the main working surface. */}
            <div className="min-h-[420px] lg:min-h-0">
                <QampiDashboardPanel />
            </div>

            {/* Right: status by default; live lead/campaign artifacts replace it. */}
            <div className="min-h-0">
              <DashboardContextPanel campaigns={campaigns} logs={recentLogs} setup={setup} loading={loading} quotas={quotas} kpis={kpis} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FirstRunExperience({ showActivationCopilot, onDismissCopilot }: {
  showActivationCopilot: boolean;
  onDismissCopilot: () => void;
}) {
  // Kept in this Suspense boundary because useSearchParams is intentionally
  // client-side: only the post-onboarding handoff uses ?tour=1.
  const params = useSearchParams();
  // The website insight reveal owns the first screen. Its acknowledgement
  // changes the query to ?tour=1, avoiding two onboarding overlays at once.
  if (params.get('welcome') === '1') return null;
  if (params.get('tour') === '1') return <FirstRunWorkspaceGuide />;
  return showActivationCopilot ? <ActivationCopilot onDismiss={onDismissCopilot} /> : null;
}
