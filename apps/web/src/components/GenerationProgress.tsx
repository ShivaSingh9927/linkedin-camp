'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';

/**
 * Staged loading indicator for the ~2-minute AI strategy pipeline.
 *
 * The backend returns 202 immediately and emits a single STRATEGY_GENERATED
 * event when the 6-agent run finishes — there are no per-agent progress
 * events. So we advance through realistic phases on a timer to communicate
 * that real, multi-step work is happening (reading → analyzing competitors →
 * crafting messaging → validating) rather than showing a dead spinner.
 *
 * The timer holds on the final "validating" phase until `active` flips false,
 * so it never claims completion before the result actually arrives.
 */
const PHASES = [
  'Reading your business profile…',
  'Understanding your market & audience…',
  'Analyzing competitors…',
  'Crafting your messaging strategy…',
  'Mapping outreach angles & objections…',
  'Validating the strategy…',
];

// Roughly paces a ~2 minute run; the last phase is sticky until done.
const STEP_MS = 14000;

export function GenerationProgress({
  active,
  variant = 'dark',
}: {
  active: boolean;
  variant?: 'dark' | 'light';
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      // Hold on the final phase — completion is signalled by `active` going false.
      setIndex((i) => Math.min(i + 1, PHASES.length - 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [active]);

  const isDark = variant === 'dark';

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
        <Loader2 className={isDark ? 'w-10 h-10 text-white/80' : 'w-10 h-10 text-primary'} />
      </motion.div>

      <div className="mt-4 h-6 relative w-full">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className={
              isDark
                ? 'text-sm font-bold text-white/90 absolute inset-0'
                : 'text-sm font-bold text-slate-700 absolute inset-0'
            }
          >
            {PHASES[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Step pips */}
      <div className="mt-4 flex items-center gap-1.5">
        {PHASES.map((_, i) => (
          <div
            key={i}
            className={[
              'h-1.5 rounded-full transition-all duration-500',
              i < index ? 'w-1.5' : i === index ? 'w-6' : 'w-1.5',
              i <= index
                ? isDark
                  ? 'bg-white'
                  : 'bg-primary'
                : isDark
                ? 'bg-white/25'
                : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>

      <p className={isDark ? 'mt-3 text-[11px] font-bold text-white/50' : 'mt-3 text-[11px] font-bold text-slate-400'}>
        This usually takes a minute or two. You can keep working — we&apos;ll notify you.
      </p>
    </div>
  );
}
