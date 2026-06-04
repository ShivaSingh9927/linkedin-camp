'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GenerationProgress } from '@/components/GenerationProgress';
import api from '@/lib/api';
import {
  Sparkles,
  Target,
  Zap,
  Clock,
  ArrowRight,
  RotateCcw,
  Loader2,
  Info,
  TrendingUp,
  MessageSquare,
  Users,
  Shield,
  Brain,
  ExternalLink,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface StrategyData {
  gtm?: {
    positioning?: string;
  };
  icp?: {
    primary?: {
      title?: string;
      companySize?: string;
      painPoints?: string[];
    };
  };
  messagingPillars?: Array<{
    pillar?: string;
    angle?: string;
    hook?: string;
  }>;
  competitiveLandscape?: {
    directCompetitors?: string[];
    ourAdvantages?: string[];
  };
  _metadata?: {
    generatedAt?: string;
    isFallback?: boolean;
  };
}

interface PerformanceMetrics {
  aiMessagesSent: number;
  replyRateImprovement: number;
  timeSavedHours: number;
  prospectsAnalyzed: number;
}

export function AICommandCenter() {
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    aiMessagesSent: 0,
    replyRateImprovement: 0,
    timeSavedHours: 0,
    prospectsAnalyzed: 0,
  });
  const [animatedMetrics, setAnimatedMetrics] = useState<PerformanceMetrics>({
    aiMessagesSent: 0,
    replyRateImprovement: 0,
    timeSavedHours: 0,
    prospectsAnalyzed: 0,
  });

  useEffect(() => {
    loadStrategy();
  }, []);

  // Animate metrics counting up
  useEffect(() => {
    if (strategy && !loading) {
      const duration = 2000;
      const steps = 60;
      const interval = duration / steps;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        setAnimatedMetrics({
          aiMessagesSent: Math.round(metrics.aiMessagesSent * eased),
          replyRateImprovement: Math.round(metrics.replyRateImprovement * eased),
          timeSavedHours: Math.round(metrics.timeSavedHours * eased * 10) / 10,
          prospectsAnalyzed: Math.round(metrics.prospectsAnalyzed * eased),
        });

        if (step >= steps) {
          clearInterval(timer);
          setAnimatedMetrics(metrics);
        }
      }, interval);

      return () => clearInterval(timer);
    }
  }, [strategy, loading]);

  const loadStrategy = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/strategy');
      if (data.strategy) {
        setStrategy(data.strategy);
        // Simulated metrics (would come from actual usage data)
        setMetrics({
          aiMessagesSent: 234,
          replyRateImprovement: 40,
          timeSavedHours: 5.2,
          prospectsAnalyzed: 156,
        });
      }
    } catch (e) {
      console.error('Failed to load strategy', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await api.post('/strategy/generate', { trigger: 'manual' });
      loadStrategy();
    } catch (e) {
      console.error('Failed to regenerate', e);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-violet-600 via-primary to-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-primary/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10 flex flex-col items-center justify-center py-12">
          <GenerationProgress active variant="dark" />
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-violet-600 via-primary to-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-primary/30"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6"
          >
            <Brain className="w-10 h-10 text-white" />
          </motion.div>
          <h3 className="text-2xl font-black mb-3">Activate Your AI Strategy</h3>
          <p className="text-sm text-white/80 mb-8 max-w-sm mx-auto">
            Complete your AI Profile to unlock personalized messaging that converts 3x better than generic outreach.
          </p>
          <Link href="/settings/ai-profile">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-2xl font-black text-sm shadow-lg hover:shadow-xl transition-shadow"
            >
              <Sparkles className="w-5 h-5" />
              Setup AI Profile
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </div>
      </motion.div>
    );
  }

  const icp = strategy.icp?.primary;
  const pillars = strategy.messagingPillars || [];
  const competitors = strategy.competitiveLandscape?.directCompetitors || [];
  const advantages = strategy.competitiveLandscape?.ourAdvantages || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-violet-600 via-primary to-indigo-600 rounded-[3rem] p-8 lg:p-10 text-white relative overflow-hidden shadow-2xl shadow-primary/30"
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
      
      {/* Floating orbs */}
      <motion.div
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-10 right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"
      />
      <motion.div
        animate={{
          x: [0, -20, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-10 left-10 w-24 h-24 bg-indigo-400/10 rounded-full blur-2xl"
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative"
            >
              <div className="absolute inset-0 bg-white/20 rounded-xl blur-lg" />
              <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <Brain className="w-6 h-6 text-white" />
              </div>
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl lg:text-2xl font-black tracking-tight">AI Strategy Command Center</h3>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                />
              </div>
              <p className="text-xs text-white/60 font-bold uppercase tracking-widest mt-0.5">
                Active & Optimizing
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-20 right-4 w-72 bg-white text-slate-900 rounded-2xl p-5 shadow-2xl z-50"
            >
              <button
                onClick={() => setShowTooltip(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="font-bold text-sm mb-2">How AI Strategy Works</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your AI analyzes your business, target audience, and competitors to create a personalized outreach strategy. 
                It then uses this strategy to write messages that sound like you and convert 3x better than generic templates.
              </p>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-primary">Pro tip:</span> Update your AI Profile anytime to refine your strategy.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ICP Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-6 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-white/80" />
            <span className="text-xs font-black uppercase tracking-widest text-white/60">Target ICP</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-black">{icp?.title || 'Not set'}</span>
            {icp?.companySize && (
              <span className="text-xs bg-white/10 px-3 py-1 rounded-full font-bold">{icp.companySize}</span>
            )}
          </div>
          {icp?.painPoints && icp.painPoints.length > 0 && (
            <p className="text-sm text-white/70 mt-2">
              Solving: <span className="text-white font-semibold">{icp.painPoints[0]}</span>
            </p>
          )}
        </motion.div>

        {/* Messaging Pillars */}
        {pillars.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-white/80" />
              <span className="text-xs font-black uppercase tracking-widest text-white/60">Messaging Pillars</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pillars.slice(0, 3).map((pillar, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.15)' }}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 cursor-default"
                >
                  <p className="text-sm font-bold mb-1">{pillar.pillar || 'Pillar'}</p>
                  <p className="text-xs text-white/60 line-clamp-2">{pillar.angle || pillar.hook || ''}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Competitive Edge */}
        {advantages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-widest text-white/60">Your Competitive Edge</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {advantages.slice(0, 3).map((adv, i) => (
                <span key={i} className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-bold">
                  {adv}
                </span>
              ))}
            </div>
            {competitors.length > 0 && (
              <p className="text-xs text-white/40 mt-2">
                vs {competitors.slice(0, 3).join(', ')}
              </p>
            )}
          </motion.div>
        )}

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-widest text-white/60">Projected Impact</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-white/60" />
                <p className="text-2xl font-black">{animatedMetrics.aiMessagesSent}</p>
              </div>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">AI Messages</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-2xl font-black">+{animatedMetrics.replyRateImprovement}%</p>
              </div>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Reply Rate</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-2xl font-black">{animatedMetrics.timeSavedHours}h</p>
              </div>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Time Saved</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <p className="text-2xl font-black">{animatedMetrics.prospectsAnalyzed}</p>
              </div>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Prospects</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link href="/settings/strategy" className="flex-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 bg-white text-primary px-6 py-3.5 rounded-xl font-black text-sm shadow-lg hover:shadow-xl transition-shadow"
            >
              View Full Strategy
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          </Link>
          <Link href="/settings/ai-profile">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-3.5 rounded-xl font-bold text-sm border border-white/20 hover:bg-white/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Refine Profile
            </motion.button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
