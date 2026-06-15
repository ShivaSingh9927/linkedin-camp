import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card — the single surface primitive. Resting `soft` shadow, hairline border,
 * `card` radius (20px). `interactive` adds the `lift` shadow + brand-tinted
 * border on hover for clickable cards. Use `panel` for large hero containers.
 *
 * Replaces the ad-hoc `bg-card rounded-[2rem] border border-border shadow-soft`
 * blocks scattered across pages — which is exactly why radii drifted.
 */
export function Card({
  className,
  interactive = false,
  panel = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; panel?: boolean }) {
  return (
    <div
      className={cn(
        'bg-card border border-line shadow-soft',
        panel ? 'rounded-panel' : 'rounded-card',
        interactive && 'transition-all hover:shadow-lift hover:border-brand-200',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />;
}
