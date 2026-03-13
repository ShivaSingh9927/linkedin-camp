'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Mail, 
  UserPlus, 
  Clock, 
  ChevronRight, 
  Trash2, 
  Sparkles,
  Zap,
  MousePointer2,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StepType = 'INVITE' | 'MESSAGE' | 'DELAY' | 'VISIT' | 'LIKE';

interface WorkflowStep {
  id: string;
  type: StepType;
  delay?: number; // hours
  text?: string;
  note?: string; // for invites
}

const STEP_METADATA: Record<StepType, { icon: any, color: string, label: string, description: string }> = {
  VISIT: {
    icon: MousePointer2,
    color: 'bg-amber-500',
    label: 'Profile Visit',
    description: 'Visit lead profile to trigger notification'
  },
  INVITE: {
    icon: UserPlus,
    color: 'bg-blue-500',
    label: 'Connection Request',
    description: 'Send a request with optional note'
  },
  MESSAGE: {
    icon: Mail,
    color: 'bg-emerald-500',
    label: 'LinkedIn Message',
    description: 'Send a direct message to connection'
  },
  DELAY: {
    icon: Clock,
    color: 'bg-slate-400',
    label: 'Wait Time',
    description: 'Pause before the next action'
  },
  LIKE: {
    icon: Zap,
    color: 'bg-purple-500',
    label: 'Like Post',
    description: 'Like the most recent post'
  }
};

export function CampaignBuilder() {
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: '1', type: 'VISIT' },
    { id: '2', type: 'DELAY', delay: 24 },
    { id: '3', type: 'INVITE', note: "Hi {{firstName}}, I'd love to connect!" }
  ]);

  const addStep = (type: StepType) => {
    const newStep: WorkflowStep = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      delay: type === 'DELAY' ? 24 : undefined
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  return (
    <div className="flex flex-col space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Campaign Sequence</h2>
          <p className="text-sm text-slate-500">Design the automation flow for this campaign.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
            <span>Pre-warmup</span>
            <div className="w-8 h-4 bg-slate-200 rounded-full relative">
              <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full shadow-sm" />
            </div>
          </button>
        </div>
      </div>

      <div className="relative space-y-12 pl-8 border-l-2 border-dashed border-slate-200 ml-4">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => {
            const meta = STEP_METADATA[step.type];
            return (
              <motion.div
                key={step.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group"
              >
                {/* Node connector dot */}
                <div className={cn(
                  "absolute -left-[45px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110",
                  meta.color
                )}>
                  <meta.icon className="w-4 h-4 text-white" />
                </div>

                <div className="bg-white rounded-3xl border shadow-sm p-6 hover:shadow-xl transition-all hover:border-primary/20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={cn("p-2 rounded-xl bg-opacity-10", meta.color.replace('bg-', 'bg-opacity-10 text-'))}>
                        <meta.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step {index + 1}</span>
                          <h4 className="font-bold text-slate-900">{meta.label}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeStep(step.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {step.type === 'DELAY' && (
                    <div className="mt-6 flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-700">Wait for</span>
                        <input 
                          type="number" 
                          defaultValue={step.delay}
                          className="w-16 h-8 bg-white border rounded-lg text-center font-bold text-primary"
                        />
                        <span className="text-sm font-bold text-slate-700">hours</span>
                      </div>
                    </div>
                  )}

                  {(step.type === 'INVITE' || step.type === 'MESSAGE') && (
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Personalized Message</span>
                        <button className="flex items-center space-x-1 text-xs font-bold text-primary hover:underline">
                          <Sparkles className="w-3 h-3" />
                          <span>AI Personalize</span>
                        </button>
                      </div>
                      <textarea 
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 min-h-[100px]"
                        placeholder={`Hi {{firstName}}, I noticed your work at {{company}}...`}
                        defaultValue={step.note || step.text}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add Step Action */}
        <div className="relative pt-4">
          <div className="absolute -left-[45px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 border-4 border-slate-50 flex items-center justify-center text-slate-400">
            <Plus className="w-4 h-4" />
          </div>
          
          <div className="flex flex-wrap gap-3">
            {(Object.keys(STEP_METADATA) as StepType[]).map((type) => {
              const meta = STEP_METADATA[type];
              return (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border rounded-2xl text-xs font-bold text-slate-600 hover:border-primary hover:text-primary hover:shadow-lg transition-all active:scale-95"
                >
                  <meta.icon className="w-3 h-3" />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
