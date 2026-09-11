'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TopBarProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function TopBar({ title, description, action, className }: TopBarProps) {
  return (
    <div className={cn("bg-background/50 backdrop-blur-md border-b border-border px-3 py-5 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight">{title}</h1>
        {description && (
          <p className="text-[13px] sm:text-sm font-bold text-muted-foreground mt-1 max-w-xl">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex w-full sm:w-auto items-center gap-3 shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none [&>a]:flex-1 sm:[&>a]:flex-none">
          {action}
        </div>
      )}
    </div>
  );
}
