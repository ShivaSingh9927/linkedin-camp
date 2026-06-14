'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASES = [
  { id: 'profile',     label: 'Reading your business profile',      sublabel: 'Collecting context…' },
  { id: 'market',      label: 'Understanding your market',           sublabel: 'Audience + industry signals…' },
  { id: 'competitors', label: 'Analyzing competitors',               sublabel: 'Mapping the landscape…' },
  { id: 'messaging',   label: 'Crafting messaging strategy',         sublabel: 'Angles, hooks, tone…' },
  { id: 'outreach',    label: 'Mapping outreach & objections',       sublabel: 'Personas + responses…' },
  { id: 'finalize',    label: 'Putting it all together',             sublabel: 'Assembling your strategy…' },
];

// A typical clean run is ~25s; under load it can stretch to 60s+. Pace the
// first 5 steps at ~6s so the bar reaches the final "Putting it all together"
// phase around 30s — which then stays animated (with elapsed-aware copy) until
// the real result lands, instead of racing to the end and parking for a minute.
const STEP_MS = 6_000;

// Reassurance lines shown on the sticky final phase, escalating with elapsed
// time so a longer-than-usual run reads as "still working", never "stuck".
const FINALIZE_TICKS = [
  { after: 0,  text: 'Assembling your strategy…' },
  { after: 12, text: 'Almost there — finalizing the details…' },
  { after: 30, text: 'Still polishing — a complex strategy takes a moment…' },
];

export function GenerationProgress({
  active,
  variant = 'dark',
}: {
  active: boolean;
  variant?: 'dark' | 'light';
}) {
  const [index, setIndex] = useState(0);
  // Seconds spent on the sticky final phase — drives escalating reassurance copy.
  const [finalizeSecs, setFinalizeSecs] = useState(0);

  useEffect(() => {
    if (!active) { setIndex(0); setFinalizeSecs(0); return; }
    const id = setInterval(() => {
      setIndex((i) => Math.min(i + 1, PHASES.length - 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [active]);

  // Once on the final phase, count elapsed seconds so the sublabel can escalate.
  const onFinal = index === PHASES.length - 1;
  useEffect(() => {
    if (!active || !onFinal) return;
    const id = setInterval(() => setFinalizeSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active, onFinal]);

  const finalizeCopy = FINALIZE_TICKS.reduce(
    (acc, t) => (finalizeSecs >= t.after ? t.text : acc),
    FINALIZE_TICKS[0].text
  );

  const isDark = variant === 'dark';

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="mb-9 text-center">
        <div className={cn(
          'inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[13px] font-black uppercase tracking-widest mb-4',
          isDark ? 'bg-white/10 text-white/70' : 'bg-primary/10 text-primary'
        )}>
          <span className="relative flex h-2.5 w-2.5">
            <span className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              isDark ? 'bg-white' : 'bg-primary'
            )} />
            <span className={cn(
              'relative inline-flex rounded-full h-2.5 w-2.5',
              isDark ? 'bg-white' : 'bg-primary'
            )} />
          </span>
          Building your AI strategy
        </div>
        <p className={cn(
          'text-xs font-bold uppercase tracking-widest',
          isDark ? 'text-white/40' : 'text-slate-400'
        )}>
          Usually 1–2 min · you can keep working
        </p>
      </div>

      {/* Steps — block is width-fit and centered so it reads balanced in the card */}
      <div className="relative w-fit mx-auto">
        {/* Vertical connector line */}
        <div className={cn(
          'absolute left-[18px] top-5 bottom-5 w-px',
          isDark ? 'bg-white/10' : 'bg-slate-200'
        )} />

        <div className="space-y-1">
          {PHASES.map((phase, i) => {
            const done    = i < index;
            const current = i === index;
            const pending = i > index;

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: pending ? 0.45 : 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className="relative flex items-start gap-4 py-2.5"
              >
                {/* Step indicator */}
                <div className="relative z-10 flex-shrink-0">
                  {done ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                    >
                      <Check className="w-4 h-4 text-white stroke-[3]" />
                    </motion.div>
                  ) : current ? (
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shadow-lg',
                      isDark ? 'bg-white shadow-white/20' : 'bg-primary shadow-primary/30'
                    )}>
                      <Loader2 className={cn(
                        'w-4 h-4 animate-spin',
                        isDark ? 'text-slate-900' : 'text-white'
                      )} />
                    </div>
                  ) : (
                    <div className={cn(
                      'w-9 h-9 rounded-full border-2 flex items-center justify-center',
                      isDark ? 'border-white/20 bg-transparent' : 'border-slate-200 bg-white'
                    )}>
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isDark ? 'bg-white/20' : 'bg-slate-300'
                      )} />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pt-1">
                  <p className={cn(
                    'text-[15px] font-bold leading-tight',
                    done    ? (isDark ? 'text-white/60'  : 'text-slate-500') :
                    current ? (isDark ? 'text-white'      : 'text-slate-900') :
                               (isDark ? 'text-white/30'  : 'text-slate-400')
                  )}>
                    {phase.label}
                    {done && (
                      <span className={cn(
                        'ml-2 text-[11px] font-black uppercase tracking-widest',
                        isDark ? 'text-emerald-400' : 'text-emerald-500'
                      )}>
                        Done
                      </span>
                    )}
                  </p>
                  {current && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        'text-xs font-bold mt-1',
                        isDark ? 'text-white/40' : 'text-slate-400'
                      )}
                    >
                      {i === PHASES.length - 1 ? finalizeCopy : phase.sublabel}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
