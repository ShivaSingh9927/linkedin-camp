'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Building2,
  Linkedin,
  Mail,
  Database,
  Check,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface SetupStep {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: any;
  accent: string; // tailwind text color
  bg: string; // tailwind bg tint
  done: boolean;
}

/**
 * Onboarding checklist shown on the dashboard until the user has finished the
 * core setup. Each card deep-links to the relevant settings page and reflects
 * live completion state from /users/me, /email-account and /auth/linkedin-status.
 * The whole container self-hides once every step is complete.
 */
export function SetupChecklist() {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<SetupStep[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Each call is independent; failures degrade to "not done" rather than
      // blocking the whole checklist.
      const [meRes, emailRes, liRes] = await Promise.allSettled([
        api.get('/users/me'),
        api.get('/email-account'),
        api.get('/auth/linkedin-status'),
      ]);

      const me = meRes.status === 'fulfilled' ? meRes.value.data : null;
      const bp = me?.businessProfile || null;
      const emailAccount =
        emailRes.status === 'fulfilled' ? emailRes.value.data?.account : null;
      const linkedinConnected =
        liRes.status === 'fulfilled' ? !!liRes.value.data?.connected : false;

      const profileDone = !!bp && !!(bp.company || bp.companyDescription || bp.aiStrategy);
      const crmDone = !!(me?.hasHubspot || me?.hasPipedrive || me?.hasNotion);
      const emailDone = !!emailAccount;

      const next: SetupStep[] = [
        {
          key: 'linkedin',
          title: 'Connect your LinkedIn',
          description: 'Securely link your account so Qampi can run outreach for you.',
          href: '/settings?tab=linkedin',
          icon: Linkedin,
          accent: 'text-[#0a66c2]',
          bg: 'bg-[#0a66c2]/10',
          done: linkedinConnected,
        },
        {
          key: 'business',
          title: 'Tell Qampi about you & your business',
          description: 'Share your company, audience and voice so the AI writes like you.',
          href: '/settings/ai-profile',
          icon: Building2,
          accent: 'text-primary',
          bg: 'bg-primary/10',
          done: profileDone,
        },
        {
          key: 'crm',
          title: 'Connect your CRM',
          description: 'Sync HubSpot, Pipedrive or Notion to push leads automatically.',
          href: '/settings/integrations',
          icon: Database,
          accent: 'text-amber-500',
          bg: 'bg-amber-500/10',
          done: crmDone,
        },
        {
          key: 'email',
          title: 'Connect your email',
          description: 'Unlock email campaigns and multi-channel sequences.',
          href: '/settings/email',
          icon: Mail,
          accent: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          done: emailDone,
        },
      ];

      if (!cancelled) {
        setSteps(next);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || steps.length === 0) return null;

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);

  // Everything done — nothing to nudge, stay out of the way.
  if (completed === total) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-[2rem] sm:rounded-[2.5rem] border border-border shadow-soft p-6 sm:p-8"
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-foreground tracking-tight">Finish setting up Qampi</h3>
            <p className="text-xs sm:text-sm font-bold text-muted-foreground mt-0.5">
              {completed} of {total} done — a few quick steps to unlock the full power of your AI.
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-2xl font-black text-primary tracking-tight">{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
          className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <AnimatePresence>
          {steps.map((step, i) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={step.href}
                className={cn(
                  'group flex items-center gap-4 p-4 rounded-2xl border transition-all h-full',
                  step.done
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105',
                    step.done ? 'bg-emerald-500/10' : step.bg
                  )}
                >
                  {step.done ? (
                    <Check className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <step.icon className={cn('w-5 h-5', step.accent)} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-black tracking-tight truncate',
                      step.done ? 'text-emerald-700' : 'text-foreground group-hover:text-primary'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-[11px] font-bold text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                    {step.done ? 'Connected' : step.description}
                  </p>
                </div>
                {!step.done && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                )}
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
