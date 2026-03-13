import { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function TopBar({ title, description, action }: TopBarProps) {
  return (
    <div className="bg-white/50 backdrop-blur-md border-b border-slate-100 px-8 py-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm font-bold text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center space-x-4">
          {action}
        </div>
      )}
    </div>
  );
}
