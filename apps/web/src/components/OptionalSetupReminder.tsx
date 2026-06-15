'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Database, Mail, X, ChevronRight, CircleDashed } from 'lucide-react';
import Link from 'next/link';
import type { SetupStatus } from './ActivationHero';

const DISMISS_KEY = 'qampi_optional_setup_dismissed';

/**
 * Surfaces leftover OPTIONAL setup (CRM / email) inside the dashboard once the
 * required steps are done. Behaviour (per design): a dismissible top strip until
 * the user dismisses it, after which it falls back to a quiet right-rail card.
 * Renders nothing if both optional steps are complete.
 *
 * `variant="strip"` → top bar (only while not dismissed).
 * `variant="rail"`  → rail card (only after dismissed).
 */
export function OptionalSetupReminder({ status, variant }: { status: SetupStatus; variant: 'strip' | 'rail' }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const pending = [
    !status.crmDone && { key: 'crm', label: 'CRM', href: '/settings/integrations', icon: Database },
    !status.emailDone && { key: 'email', label: 'Email', href: '/settings/email', icon: Mail },
  ].filter(Boolean) as { key: string; label: string; href: string; icon: typeof Database }[];

  if (pending.length === 0 || dismissed === null) return null;

  if (variant === 'strip') {
    if (dismissed) return null;
    return (
      <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-100 rounded-card p-3.5 pl-5 flex items-center gap-4">
        <div className="w-8 h-8 rounded-control bg-white text-brand grid place-items-center shrink-0 shadow-soft">
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="text-[13px] font-medium text-ink-700 flex-1">
          Want more results? Connect your{' '}
          {pending.map((p, i) => (
            <span key={p.key}><b>{p.label.toLowerCase()}</b>{i < pending.length - 1 ? ' and ' : ''}</span>
          ))}{' '}to get the most out of Qampi.
        </p>
        {pending.map((p) => (
          <Link key={p.key} href={p.href} className="text-[12px] font-semibold text-brand bg-white border border-brand-100 rounded-chip px-3 py-1.5 flex items-center gap-1.5">
            <p.icon className="w-3.5 h-3.5" />{p.label}
          </Link>
        ))}
        <button
          onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
          className="text-ink-400 hover:text-ink-700"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // rail variant — only after the strip is dismissed
  if (!dismissed) return null;
  return (
    <div className="rounded-card bg-card border border-dashed border-brand-200 p-5">
      <div className="flex items-center gap-2 text-brand">
        <CircleDashed className="w-4 h-4" />
        <span className="label !text-brand">Finish your setup</span>
      </div>
      <p className="text-[12px] text-ink-500 font-medium mt-2">{pending.length} optional add-on{pending.length > 1 ? 's' : ''} left.</p>
      <div className="mt-3 space-y-2">
        {pending.map((p) => (
          <Link key={p.key} href={p.href} className="w-full flex items-center gap-2 text-[13px] font-semibold text-ink-700 bg-surface rounded-control px-3 py-2 hover:bg-brand-50 hover:text-brand transition-colors">
            <p.icon className="w-4 h-4" />Connect {p.label.toLowerCase()}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
