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
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5 sm:mb-7">
      <div className="min-w-0">
        {eyebrow && <span className="label !text-brand">{eyebrow}</span>}
        <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight sm:leading-none text-foreground mt-2 break-words">{title}</h1>
        {subtitle && <p className="text-[13px] sm:text-base text-ink-500 font-medium mt-1.5 sm:mt-2 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-shrink-0 [&>*]:min-w-0">{actions}</div>}
    </div>
  );
}
