import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badge — single pill style, tone-driven. One radius (chip), one weight (600).
 * Use for statuses (Running/Paused/Draft), degrees (1st/2nd), health, etc.
 * `dot` prepends a status dot. Replaces every inline `text-[10px] font-black
 * uppercase ... rounded-full bg-x/10 text-x` snippet.
 */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[11px] font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface text-ink-500',
        brand: 'bg-brand-50 text-brand',
        success: 'bg-emerald-50 text-emerald-600',
        warning: 'bg-amber-50 text-amber-600',
        info: 'bg-blue-50 text-blue-600',
        danger: 'bg-red-50 text-red-600',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const dotColor: Record<string, string> = {
  neutral: 'bg-ink-400',
  brand: 'bg-brand',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  danger: 'bg-red-500',
};

export function Badge({
  className,
  tone,
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean }) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor[tone ?? 'neutral'])} />}
      {children}
    </span>
  );
}
