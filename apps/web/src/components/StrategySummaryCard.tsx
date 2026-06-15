'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Strategy summary. `compact` renders the small right-rail card used on the
 * dashboard (matches the approved mock); the default is the full-width banner.
 *
 * Honest by construction: every value comes from the saved strategy; nothing is
 * estimated. If there's no strategy yet, it nudges the user to create one.
 */
export function StrategySummaryCard({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<any>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/strategy');
        if (!cancelled) {
          setStrategy(data?.strategy || null);
          const cs = (data?.confirmedSections as Record<string, boolean>) || {};
          setConfirmedCount(Object.values(cs).filter(Boolean).length);
        }
      } catch (e) {
        console.error('Failed to load strategy summary', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className={cn('flex items-center justify-center', compact ? 'p-5 h-32' : 'p-6')}>
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
      </Card>
    );
  }

  const positioning: string = strategy?.gtm?.positioning || '';
  const target: string = strategy?.icp?.primary?.title || '';
  const sizeBand: string = strategy?.icp?.primary?.companySize || '';
  const edge: string = (Array.isArray(strategy?.competitiveLandscape?.ourAdvantages) && strategy.competitiveLandscape.ourAdvantages[0]) || '';
  const confirmed = confirmedCount >= 7 || !!strategy?._metadata?.confirmedAt;

  // ── Compact right-rail card (dashboard) ──
  if (compact) {
    if (!strategy) {
      return (
        <Link href="/settings/ai-profile">
          <div className="rounded-card bg-gradient-to-br from-brand-50 to-white border border-brand-100 p-5 hover:border-brand-200 transition-colors">
            <div className="flex items-center gap-2 text-brand">
              <Sparkles className="w-4 h-4" />
              <span className="label !text-brand">Your AI strategy</span>
            </div>
            <p className="text-[13px] font-medium text-ink-700 mt-2 leading-relaxed">
              Tell Aigeon about your business so it can write messages that sound like you.
            </p>
            <span className="text-[12px] font-semibold text-brand mt-3 inline-block">Build strategy →</span>
          </div>
        </Link>
      );
    }
    return (
      <div className="rounded-card bg-gradient-to-br from-brand-50 to-white border border-brand-100 p-5">
        <div className="flex items-center gap-2 text-brand">
          <Sparkles className="w-4 h-4" />
          <span className="label !text-brand">Your AI strategy {confirmed ? '· confirmed' : '· ready'}</span>
        </div>
        {positioning && <p className="text-[13px] font-medium text-ink-700 mt-2 leading-relaxed line-clamp-3">{positioning}</p>}
        {target && (
          <p className="text-[12px] font-medium text-ink-500 mt-2">
            Targets <b className="text-ink-700">{target}{sizeBand ? ` (${sizeBand})` : ''}</b>
          </p>
        )}
        <Link href="/settings/strategy" className="text-[12px] font-semibold text-brand mt-3 inline-block">View full strategy →</Link>
      </div>
    );
  }

  // ── Full-width banner (other surfaces) ──
  if (!strategy) {
    return (
      <Link href="/settings/ai-profile">
        <Card interactive className="bg-gradient-to-br from-brand-50 to-white p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-control bg-white shadow-soft grid place-items-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">Build your AI strategy</p>
            <p className="text-[13px] font-medium text-ink-500 mt-0.5">Tell Aigeon about your business so it can write messages that sound like you.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-brand flex-shrink-0" />
        </Card>
      </Link>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="w-12 h-12 rounded-control bg-white shadow-soft grid place-items-center flex-shrink-0">
        <Sparkles className="w-6 h-6 text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="label !text-brand">Your AI strategy {confirmed ? '· confirmed' : '· ready'}</span>
        {positioning && <p className="text-[15px] font-semibold text-foreground leading-relaxed line-clamp-2 mt-1.5">{positioning}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
          {target && <span className="text-[13px] font-medium text-ink-500">Targets <b className="text-ink-700">{target}{sizeBand ? ` (${sizeBand})` : ''}</b></span>}
          {edge && <span className="text-[13px] font-medium text-ink-500">Edge <b className="text-ink-700">{edge}</b></span>}
        </div>
      </div>
      <Link href="/settings/strategy" className="flex-shrink-0">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand bg-white border border-line rounded-control px-5 py-3 hover:bg-brand-50 transition-colors">
          View full strategy <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
    </Card>
  );
}
