'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Linkedin, Mail, Database, Check } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { Card, Button } from '@/components/ui';

export interface SetupStatus {
  requiredDone: boolean;
  profileDone: boolean;
  linkedinDone: boolean;
  crmDone: boolean;
  emailDone: boolean;
}

/**
 * Onboarding (State 1). Renders the full-page "launch your first campaign" flow:
 * a horizontal milestone for the two REQUIRED steps (AI profile → LinkedIn) and
 * a secondary row of OPTIONAL add-ons (CRM, email). Shown by the dashboard only
 * while required setup is incomplete; returns null once both required steps are
 * done (the dashboard then renders its performance view).
 *
 * Reports full setup status to the parent via onResolved so the dashboard can
 * (a) decide which view to show and (b) surface leftover optional steps.
 */
export function ActivationHero({ onResolved }: { onResolved?: (status: SetupStatus) => void }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setFirstName((JSON.parse(raw)?.name || '').split(/\s+/)[0] || '');
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      const [meRes, emailRes, liRes] = await Promise.allSettled([
        api.get('/users/me'),
        api.get('/email-account'),
        api.get('/auth/linkedin-status'),
      ]);
      const me = meRes.status === 'fulfilled' ? meRes.value.data : null;
      const bp = me?.businessProfile || null;
      const profileDone = !!bp && !!(bp.company || bp.companyDescription || bp.aiStrategy);
      const linkedinDone = liRes.status === 'fulfilled' ? !!liRes.value.data?.connected : false;
      const crmDone = !!(me?.hasHubspot || me?.hasPipedrive || me?.hasNotion);
      const emailDone = emailRes.status === 'fulfilled' ? !!emailRes.value.data?.account : false;

      const s: SetupStatus = { profileDone, linkedinDone, crmDone, emailDone, requiredDone: profileDone && linkedinDone };
      if (!cancelled) {
        setStatus(s);
        setLoading(false);
        onResolved?.(s);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !status) return null;
  if (status.requiredDone) return null; // dashboard takes over

  const required = [
    { key: 'profile', title: 'Your AI profile', desc: 'Aigeon studied your business and built your strategy.', icon: Building2, href: '/settings/ai-profile', done: status.profileDone, cta: 'Set up' },
    { key: 'linkedin', title: 'Connect LinkedIn', desc: 'Securely link your account so Aigeon can act for you.', icon: Linkedin, href: '/settings?tab=linkedin', done: status.linkedinDone, cta: 'Connect now' },
  ];
  const optional = [
    { key: 'crm', title: 'Connect your CRM', desc: 'Sync replies & leads to HubSpot, Pipedrive or Notion.', icon: Database, href: '/settings/integrations', done: status.crmDone },
    { key: 'email', title: 'Connect your email', desc: 'Add email outreach alongside your LinkedIn sequence.', icon: Mail, href: '/settings/email', done: status.emailDone },
  ];
  const requiredCount = required.filter((s) => s.done).length;
  const nextKey = required.find((s) => !s.done)?.key;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-7">
        <span className="label !text-brand">Welcome to Qampi</span>
        <h1 className="text-[28px] font-bold tracking-tight leading-none mt-2 text-foreground">
          Let&apos;s launch your first campaign{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-ink-500 font-medium mt-2">
          Two quick steps to go live. Your performance shows up here once your first campaign runs.
        </p>
      </div>

      {/* REQUIRED — horizontal milestone */}
      <Card className="p-7">
        <div className="flex items-center justify-between mb-6">
          <span className="label">Required to launch</span>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-ink-500">{requiredCount} of 2 done</span>
            <div className="w-28 h-2 bg-surface rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(requiredCount / 2) * 100}%` }} transition={{ duration: 0.5 }} className="h-full rounded-full bg-brand" />
            </div>
          </div>
        </div>

        <div className="flex items-stretch">
          {required.map((step, i) => {
            const isNext = step.key === nextKey;
            const Icon = step.icon;
            return (
              <div key={step.key} className="contents">
                <div className="flex-1 flex flex-col items-center text-center px-4">
                  <div className={cn('w-14 h-14 rounded-full grid place-items-center mb-3',
                    step.done ? 'bg-emerald-500 text-white' : isNext ? 'bg-brand text-white shadow-lift ring-4 ring-brand-100' : 'bg-surface text-ink-400')}>
                    {step.done ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                  </div>
                  <div className="text-[15px] font-semibold text-foreground">{step.title}</div>
                  <p className="text-[12px] text-ink-500 font-medium mt-1 max-w-[210px]">{step.desc}</p>
                  {step.done ? (
                    <span className="label !text-emerald-600 mt-3">Completed</span>
                  ) : (
                    <Link href={step.href} className="mt-3">
                      <Button size="sm">
                        {step.key === 'linkedin' && <Linkedin className="w-4 h-4" />}
                        {step.cta}
                      </Button>
                    </Link>
                  )}
                </div>
                {i < required.length - 1 && (
                  <div className="flex items-center pt-7">
                    <div className={cn('h-[2px] w-12 lg:w-24 rounded-full', required[0].done ? 'bg-emerald-400' : 'bg-line')} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* OPTIONAL — secondary add-ons */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="label">Optional add-ons</span>
          <span className="text-[12px] text-ink-400 font-medium">— boost results, do anytime</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {optional.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.key} className={cn('p-5 flex items-center gap-4', step.done ? '!border-emerald-200' : 'border-dashed')}>
                <div className={cn('w-10 h-10 rounded-control grid place-items-center shrink-0', step.done ? 'bg-emerald-50 text-emerald-600' : 'bg-surface text-ink-500')}>
                  {step.done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] text-foreground">{step.title}</div>
                  <p className="text-[12px] text-ink-500 font-medium">{step.desc}</p>
                </div>
                {step.done ? (
                  <span className="label !text-emerald-600">Done</span>
                ) : (
                  <Link href={step.href}>
                    <Button variant="outline" size="sm">Connect</Button>
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[13px] text-ink-400 font-medium mt-8">
        Finish the two required steps and your dashboard unlocks automatically.
      </p>
    </motion.div>
  );
}
