'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { SetupStatus } from './ActivationHero';

const DISMISS_KEY = 'qampi_profile_nudge_dismissed';

// Below this share of core fields, Qampi's AI is working with too little to
// personalize well — worth nudging the user to fill more in.
const STRENGTH_THRESHOLD = 0.75;

/**
 * Dashboard strip that nudges the user to finish their AI profile / strategy so
 * Qampi understands their business. Distinct from OptionalSetupReminder (CRM +
 * email): this is about the profile QUALITY that drives message quality, which
 * nothing surfaced before — a one-field profile counted as "done" everywhere.
 *
 * Adapts its ask to the biggest gap (fill the profile → generate a strategy →
 * review the strategy) and disappears once the profile is strong AND the
 * strategy is confirmed. Dismissible; dismissal persists in localStorage.
 */
export function ProfileCompletionNudge({ status }: { status: SetupStatus }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const weakProfile = status.profileStrength < STRENGTH_THRESHOLD;
  const pct = Math.round(status.profileStrength * 100);

  // Pick the single most important gap to ask about.
  let gap: { headline: string; sub: string; cta: string } | null = null;
  if (weakProfile) {
    gap = {
      headline: 'Complete your AI profile',
      sub: `Qampi is running on ${pct}% of your profile — the more it knows about your business, the sharper every message it writes.`,
      cta: 'Complete profile',
    };
  } else if (status.strategyState === 'none') {
    gap = {
      headline: 'Generate your AI strategy',
      sub: 'Qampi hasn’t built your outreach strategy yet. Generate it so it knows how to position you.',
      cta: 'Build strategy',
    };
  } else if (status.strategyState === 'unconfirmed') {
    gap = {
      headline: 'Review & confirm your AI strategy',
      sub: 'Qampi drafted your strategy. Give it a quick review and confirm so it runs the way you want.',
      cta: 'Review strategy',
    };
  }

  if (!gap || dismissed === null || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-100 rounded-card p-3.5 pl-5 flex items-center gap-4">
      <div className="w-8 h-8 rounded-control bg-white text-brand grid place-items-center shrink-0 shadow-soft">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink-800">{gap.headline}</p>
        <p className="text-[12px] font-medium text-ink-500 mt-0.5">{gap.sub}</p>
      </div>
      <Link
        href="/settings/ai-profile"
        className="text-[12px] font-semibold text-white bg-brand rounded-chip px-3.5 py-2 flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity"
      >
        {gap.cta}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      <button
        onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
        className="text-ink-400 hover:text-ink-700 shrink-0"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
