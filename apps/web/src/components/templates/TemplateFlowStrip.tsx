'use client';

const NODE_ICONS: Record<string, string> = {
  PROFILE_VISIT: '👤',
  WAIT: '⏳',
  CONNECT: '🔗',
  MESSAGE: '💬',
  LIKE: '👍',
  COMMENT: '💭',
  EMAIL_FINDER: '📡',
  EMAIL: '📧',
  FOLLOW: '👣',
  CRM_SYNC: '📊',
  IF_ELSE: '🔀',
  START: '▶',
  END: '✅',
};

const NODE_COLORS: Record<string, string> = {
  PROFILE_VISIT: '#3b82f6',
  WAIT: '#f59e0b',
  CONNECT: '#8b5cf6',
  MESSAGE: '#ec4899',
  LIKE: '#ef4444',
  COMMENT: '#f97316',
  EMAIL_FINDER: '#06b6d4',
  EMAIL: '#10b981',
  FOLLOW: '#6b7280',
  CRM_SYNC: '#6366f1',
  IF_ELSE: '#14b8a6',
  START: '#22c55e',
  END: '#22c55e',
};

interface TemplateFlowStripProps {
  nodes: { subType: string; data?: { label?: string } }[];
  maxSteps?: number;
}

export function TemplateFlowStrip({ nodes, maxSteps = 5 }: TemplateFlowStripProps) {
  const steps = nodes.filter(n => n.subType !== 'START').slice(0, maxSteps);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      {steps.map((node, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm flex-shrink-0"
            style={{ backgroundColor: `${NODE_COLORS[node.subType] || '#94a3b8'}15` }}
          >
            <span className="text-base leading-none">
              {NODE_ICONS[node.subType] || '•'}
            </span>
          </div>
          {i < steps.length - 1 && (
            <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 16 16">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
      {nodes.filter(n => n.subType !== 'START').length > maxSteps && (
        <span className="text-[10px] font-bold text-slate-400 ml-1">+{nodes.filter(n => n.subType !== 'START').length - maxSteps}</span>
      )}
    </div>
  );
}
