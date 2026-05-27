'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, ArrowRight, Check } from 'lucide-react';

export function AIProfileBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [completion, setCompletion] = useState(0);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/v1/users/me');
      const data = await res.json();
      if (data.businessProfile) {
        setProfile(data.businessProfile);
        calculateCompletion(data.businessProfile);
      }
    } catch (e) {
      console.error('Failed to load profile', e);
    }
  };

  const calculateCompletion = (bp: any) => {
    const fields = [
      bp.companyDescription, bp.products, bp.targetAudience, bp.communicationStyle,
      bp.industry, bp.mainPainPoint, bp.differentiators, bp.caseStudies,
      bp.writingSamples?.length > 0, bp.tonePreferences?.length > 0,
    ];
    const filled = fields.filter(Boolean).length;
    setCompletion(Math.round((filled / fields.length) * 100));
    setVisible(completion < 100 && !bp.aiStrategy);
  };

  if (!visible || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary/10 via-indigo-50 to-purple-50 border border-primary/20 rounded-xl p-4 relative"
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-sm">
            Complete your AI Profile to unlock personalized messages
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Your AI is {completion}% ready. Add business context to make your outreach messages 3x more effective.
          </p>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completion}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full"
            />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <a
              href="/settings/ai-profile"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Complete Profile
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            {profile?.aiStrategy && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                Strategy ready
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
