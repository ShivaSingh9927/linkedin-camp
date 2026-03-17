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
    <div className={cn("bg-background/50 backdrop-blur-md border-b border-border px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4", className)}>
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight">{title}</h1>
        {description && (
          <p className="text-sm font-bold text-muted-foreground mt-1 max-w-xl">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center space-x-3 shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
