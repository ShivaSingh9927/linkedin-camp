import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * SectionHeader — consistent "title + optional action" row used above lists and
 * cards. One title weight (bold), action is a muted brand link on the right.
 */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="font-bold tracking-tight text-foreground">{title}</h3>
      {action}
    </div>
  );
}

/** PageHeader — the h1 + subtitle block at the top of every page. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
      <div>
        {eyebrow && <span className="label !text-brand">{eyebrow}</span>}
        <h1 className="text-[28px] font-bold tracking-tight leading-none text-foreground mt-2">{title}</h1>
        {subtitle && <p className="text-ink-500 font-medium mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
