import { cn } from '@/lib/utils';

/**
 * Avatar — initials chip. Brand-tinted by default. One consistent treatment for
 * leads/people across Prospects, Campaign detail, Inbox. Pass `src` for a real
 * image; falls back to initials from `name`.
 */
function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const sizes: Record<string, string> = {
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-9 h-9 text-[12px]',
  lg: 'w-11 h-11 text-[14px]',
};

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? ''} className={cn('rounded-full object-cover', sizes[size], className)} />;
  }
  return (
    <div className={cn('rounded-full bg-brand-100 text-brand grid place-items-center font-bold shrink-0', sizes[size], className)}>
      {initials(name)}
    </div>
  );
}
