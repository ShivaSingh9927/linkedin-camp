import { cn } from '@/lib/utils';

/**
 * Skeleton — loading placeholder. Use instead of bare spinners for content that
 * has a known shape (cards, rows, tiles), so the page feels finished while data
 * loads. `rounded` defaults to control radius.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface rounded-control', className)} />;
}
