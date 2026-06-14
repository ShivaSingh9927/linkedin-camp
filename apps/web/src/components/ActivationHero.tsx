'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Linkedin, Mail, Database, Check, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Step {
  key: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: any;
  done: boolean;
}

/**
 * Dark "let's get your first campaign live" activation hero shown on the
 * dashboard until the four setup steps (AI profile, LinkedIn, CRM, email) are
 * complete. Reflects live completion from /users/me, /email-account and
 * /auth/linkedin-status — same sources as the old SetupChecklist, which this
 * replaces on the dashboard. Self-hides once all four are done.
 *
 * onResolved(done) lets the parent know whether setup is complete so it can
 * decide which performance view to render (it fires once after the fetch).
 */
export function ActivationHero({ onResolved }: { onResolved?: (allDone: boolean) => void }) {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [meRes, emailRes, liRes] = await Promise.allSettled([
        api.get('/users/me'),
        api.get('/email-account'),
        api.get('/auth/linkedin-status'),
      ]);
      const me = meRes.status === 'fulfilled' ? meRes.value.data : null;
      const bp = me?.businessProfile || null;
      const emailAccount = emailRes.status === 'fulfilled' ? emailRes.value.data?.account : null;
      const linkedinConnected = liRes.status === 'fulfilled' ? !!liRes.value.data?.connected : false;

      const profileDone = !!bp && !!(bp.company || bp.companyDescription || bp.aiStrategy);
      const crmDone = !!(me?.hasHubspot || me?.hasPipedrive || me?.hasNotion);
      const emailDone = !!emailAccount;

      const next: Step[] = [
        { key: 'business', title: 'Your AI profile', description: 'Aigeon studies your business and builds your strategy.', cta: 'Set up profile', href: '/settings/ai-profile', icon: Building2, done: profileDone },
        { key: 'linkedin', title: 'Connect LinkedIn', description: 'Securely link your account so Aigeon can act for you.', cta: 'Connect LinkedIn', href: '/settings?tab=linkedin', icon: Linkedin, done: linkedinConnected },
        { key: 'crm', title: 'Connect your CRM', description: 'Sync replies & leads to HubSpot, Pipedrive or Notion.', cta: 'Connect CRM', href: '/settings/integrations', icon: Database, done: crmDone },
        { key: 'email', title: 'Connect your email', description: 'Add email outreach alongside your LinkedIn sequence.', cta: 'Connect email', href: '/settings/email', icon: Mail, done: emailDone },
      ];

      if (!cancelled) {
        setSteps(next);
        setLoading(false);
        onResolved?.(next.every((s) => s.done));
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || steps.length === 0) return null;

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);
  if (completed === total) return null; // all set — get out of the way

  // First not-done step is the "next" highlighted action.
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-[#0f1024] to-[#241a4d] text-white p-7 sm:p-10 shadow-xl shadow-slate-300/40"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <h2 className="text-2xl sm:text-[28px] font-black tracking-tight">Let&apos;s get your first campaign live</h2>
          <p className="mt-2.5 text-[15px] sm:text-base font-medium text-white/60 max-w-xl">
            Complete these to unlock the full power of your AI. <span className="font-black text-white">{completed} of {total} done.</span>
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/[0.08] border border-white/10 rounded-2xl px-4 py-2.5 self-start">
          <span className="text-[13px] font-bold text-white/70">Setup</span>
          <div className="w-28 h-[7px] rounded-full bg-white/15 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} className="h-full rounded-full bg-emerald-500" />
          </div>
          <span className="text-[13px] font-black">{pct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {steps.map((step, i) => {
          const isNext = step.key === nextKey;
          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'rounded-2xl border p-5 flex flex-col',
                step.done ? 'bg-emerald-500/[0.12] border-emerald-500/30' : 'bg-white/[0.06] border-white/10'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full grid place-items-center font-black text-sm mb-4',
                step.done ? 'bg-emerald-500 text-white' : isNext ? 'bg-white text-[#1a1140]' : 'bg-white/12 text-white'
              )}>
                {step.done ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
              </div>
              <h3 className="text-[17px] font-extrabold">{step.title}</h3>
              <p className="text-[13px] font-medium text-white/55 mt-1.5 leading-snug flex-1">{step.description}</p>
              {step.done ? (
                <div className="mt-4 text-xs font-black uppercase tracking-wider text-emerald-400">✓ Done</div>
              ) : (
                <Link href={step.href}>
                  <button className={cn(
                    'mt-4 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-all',
                    isNext ? 'bg-white text-[#1a1140] hover:bg-white/90' : 'bg-white/[0.12] text-white hover:bg-white/[0.18]'
                  )}>
                    {step.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
