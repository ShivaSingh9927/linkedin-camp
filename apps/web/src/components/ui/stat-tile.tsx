import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

type Tone = 'brand' | 'success' | 'warning' | 'info' | 'neutral';

const iconTone: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-blue-50 text-blue-600',
  neutral: 'bg-surface text-ink-500',
};

/**
 * StatTile — the KPI card. One icon chip + big tabular number + label.
 * `sub` renders a muted suffix (e.g. "/80"). Measured values only — there is
 * deliberately no prop for a fabricated delta.
 */
export function StatTile({
  icon: Icon,
  value,
  label,
  sub,
  tone = 'brand',
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className={cn('w-9 h-9 rounded-control grid place-items-center', iconTone[tone])}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <p className="num text-[30px] mt-4 leading-none">
        {value}
        {sub && <span className="text-ink-400 text-[16px] font-semibold ml-1">{sub}</span>}
      </p>
      <p className="label mt-2">{label}</p>
    </Card>
  );
}
