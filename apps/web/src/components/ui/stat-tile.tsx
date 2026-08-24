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
  compact = false,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone?: Tone;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn(compact ? 'p-3.5' : 'p-5', className)}>
      <div className={cn('rounded-control grid place-items-center', iconTone[tone], compact ? 'w-7 h-7' : 'w-9 h-9')}>
        <Icon className={compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
      </div>
      <p className={cn('num leading-none', compact ? 'text-[22px] mt-2.5' : 'text-[30px] mt-4')}>
        {value}
        {sub && <span className={cn('text-ink-400 font-semibold ml-1', compact ? 'text-[13px]' : 'text-[16px]')}>{sub}</span>}
      </p>
      <p className={cn('label', compact ? 'mt-1.5' : 'mt-2')}>{label}</p>
    </Card>
  );
}
