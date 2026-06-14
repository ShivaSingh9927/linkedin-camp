'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

/**
 * Compact, single-line strategy summary for the dashboard. Replaces both the
 * old full-width "Here's what I've learned about you" hero AND the large purple
 * AICommandCenter (which showed hardcoded/simulated metrics). The full strategy
 * lives on its own page now — this is just a confident one-liner + a link.
 *
 * Honest by construction: every value comes from the saved strategy; nothing is
 * estimated or projected. If there's no strategy yet, it nudges the user to
 * create one instead of showing empty scaffolding.
 */
export function StrategySummaryCard() {
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
      <div className="rounded-[1.75rem] border border-primary/15 bg-primary/[0.04] p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  // No strategy yet — nudge, don't show empty scaffolding.
  if (!strategy) {
    return (
      <Link href="/settings/ai-profile">
        <div className="group rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-fuchsia-50/60 p-6 flex items-center gap-4 hover:border-primary/30 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-[0_0_0_1px_rgba(124,92,252,.12)] grid place-items-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900">Build your AI strategy</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Tell Aigeon about your business so it can write messages that sound like you.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </div>
      </Link>
    );
  }

  const positioning: string = strategy?.gtm?.positioning || '';
  const target: string = strategy?.icp?.primary?.title || '';
  const sizeBand: string = strategy?.icp?.primary?.companySize || '';
  const edge: string = (Array.isArray(strategy?.competitiveLandscape?.ourAdvantages) && strategy.competitiveLandscape.ourAdvantages[0]) || '';
  const confirmed = confirmedCount >= 7 || !!strategy?._metadata?.confirmedAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-[#faf7ff] to-fuchsia-50/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5"
    >
      <div className="w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-2xl bg-white shadow-[0_0_0_1px_rgba(124,92,252,.12)] grid place-items-center flex-shrink-0">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary mb-1.5">
          Your AI Strategy {confirmed ? '· confirmed' : '· ready'}
        </p>
        {positioning && (
          <p className="text-[15px] font-bold text-slate-800 leading-relaxed line-clamp-2">{positioning}</p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
          {target && <span className="text-[13px] font-bold text-slate-500">Targets <b className="text-slate-800">{target}{sizeBand ? ` (${sizeBand})` : ''}</b></span>}
          {edge && <span className="text-[13px] font-bold text-slate-500">Edge <b className="text-slate-800">{edge}</b></span>}
        </div>
      </div>
      <Link href="/settings/strategy" className="flex-shrink-0">
        <button className="inline-flex items-center gap-2 text-sm font-extrabold text-primary bg-white border border-primary/15 rounded-2xl px-5 py-3 hover:bg-primary/5 transition-colors">
          View full strategy <ArrowRight className="w-4 h-4" />
        </button>
      </Link>
    </motion.div>
  );
}
