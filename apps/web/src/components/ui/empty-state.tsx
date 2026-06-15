import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

/**
 * EmptyState — designed empty state (not an afterthought). Centered icon chip,
 * plain-spoken title + body, optional CTA. Use whenever a list/section has no
 * data yet, instead of a bare spinner or blank area.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-12 sm:p-16 text-center', className)}>
      <div className="w-14 h-14 rounded-control bg-surface text-ink-400 grid place-items-center mx-auto mb-5">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
      {description && (
        <p className="text-[13px] font-medium text-ink-500 mt-2 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  );
}
