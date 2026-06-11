'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, Clock, RotateCcw, Save, Loader2, AlertCircle, Check, Zap } from 'lucide-react';
import { io as socketIO, Socket } from 'socket.io-client';
import { GenerationProgress } from '@/components/GenerationProgress';
import PillarEditor from '@/components/PillarEditor';
import api from '@/lib/api';

const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');

const sections = [
  { key: 'gtm', label: 'Go-to-Market', icon: '🎯' },
  { key: 'icp', label: 'Ideal Customer Profile', icon: '👤' },
  { key: 'messagingPillars', label: 'Messaging Pillars', icon: '💬' },
  { key: 'outreachAngles', label: 'Outreach Angles', icon: '' },
  { key: 'objections', label: 'Objection Handling', icon: '️' },
  { key: 'competitiveLandscape', label: 'Competitive Landscape', icon: '⚔️' },
  { key: 'commentStrategy', label: 'Comment Strategy', icon: '💭' },
];

export default function StrategyPage() {
  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [pillarSaving, setPillarSaving] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Arriving from the AI Profile page right after kicking off generation:
    // show the staged progress immediately while the background pipeline runs.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('generating') === '1') {
      setRegenerating(true);
    }
    loadStrategy();
  }, []);

  // Subscribe to STRATEGY_GENERATED — backend emits this when the
  // 6-agent pipeline finishes (~2 min). The HTTP POST returned 202
  // immediately, so this is how we learn the result.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const s = socketIO(apiBase, { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('connect', () => s.emit('join_room', { token }));
    s.on('STRATEGY_GENERATED', (payload: { success?: boolean; strategy?: any; status?: string; error?: string }) => {
      setRegenerating(false);
      if (payload?.success && payload.strategy) {
        setStrategy(payload.strategy);
        setGeneratedAt(new Date().toISOString());
        setIsFallback(payload.strategy?._metadata?.isFallback || false);
        setIsCached(false);
      } else if (payload?.status === 'rate_limited') {
        setRateLimitError(payload.error || 'Rate limit exceeded.');
      } else {
        setRateLimitError(payload?.error || 'Strategy generation failed.');
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const loadStrategy = async () => {
    setLoading(true);
    try {
      // api client attaches the Bearer token (a bare fetch would 401).
      const { data } = await api.get('/strategy');
      if (data.strategy) {
        setStrategy(data.strategy);
        setGeneratedAt(data.generatedAt);
        setIsFallback(data.strategy._metadata?.isFallback || false);
        const expanded: Record<string, boolean> = {};
        sections.forEach(s => expanded[s.key] = false);
        setExpandedSections(expanded);
      }
    } catch (e) {
      console.error('Failed to load strategy', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const startEdit = (key: string) => {
    setEditValues(prev => ({ ...prev, [key]: JSON.stringify(strategy[key], null, 2) }));
    setEditMode(prev => ({ ...prev, [key]: true }));
  };

  const saveEdit = async (key: string) => {
    setSaving(true);
    try {
      const parsed = JSON.parse(editValues[key]);
      const updated = { ...strategy, [key]: parsed };
      await api.put('/strategy', { overrides: { [key]: parsed } });
      setStrategy(updated);
      setEditMode(prev => ({ ...prev, [key]: false }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Invalid JSON. Please fix the format.');
    } finally {
      setSaving(false);
    }
  };

  const handlePillarSave = async (updated: any[]) => {
    setPillarSaving(true);
    try {
      const updatedStrategy = { ...strategy, messagingPillars: updated };
      await api.put('/strategy', { overrides: { messagingPillars: updated } });
      setStrategy(updatedStrategy);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save pillars', e);
    } finally {
      setPillarSaving(false);
    }
  };

  const handleRegenerate = async (force: boolean = false) => {
    setRegenerating(true);
    setRateLimitError(null);
    try {
      // Backend returns 202 — the 6-agent pipeline runs in the background and
      // pushes the result via STRATEGY_GENERATED Socket.IO event. The useEffect
      // listener above flips regenerating=false when it arrives.
      await api.post('/strategy/generate', { trigger: 'manual', force_regenerate: force });
    } catch (e: any) {
      if (e?.response?.status === 429) {
        setRateLimitError(e.response.data?.error || 'Rate limit exceeded. Please wait before generating another strategy.');
      } else {
        console.error('Failed to regenerate', e);
        setRateLimitError('Failed to regenerate strategy. Please try again.');
      }
      setRegenerating(false);
    }
  };

  const renderValue = (value: any, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-slate-400 italic">Not set</span>;
    if (typeof value === 'string') return <span className="text-slate-700">{value}</span>;
    if (typeof value === 'number') return <span className="text-primary font-semibold">{value}</span>;
    if (typeof value === 'boolean') return <span className={value ? 'text-emerald-600' : 'text-red-500'}>{value ? 'Yes' : 'No'}</span>;
    if (Array.isArray(value)) {
      return (
        <ul className={`space-y-1 ${depth > 0 ? 'ml-4' : ''}`}>
          {value.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary mt-1.5">•</span>
              {typeof item === 'object' ? (
                <div className="flex-1">{renderValue(item, depth + 1)}</div>
              ) : (
                <span className="text-slate-700 text-sm">{String(item)}</span>
              )}
            </li>
          ))}
        </ul>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className={`space-y-2 ${depth > 0 ? 'ml-4' : ''}`}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k}>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k}</span>
              <div className="mt-1">{renderValue(v, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Generation in progress — show staged progress (arriving fresh from the AI
  // Profile page, or after hitting Regenerate). The STRATEGY_GENERATED socket
  // listener flips `regenerating` false and populates the strategy when done.
  if (regenerating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-soft p-10">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-slate-900">Building your AI strategy</h2>
          </div>
          <GenerationProgress active variant="light" />
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Strategy Yet</h2>
          <p className="text-slate-500 mb-6">Complete your AI Profile and generate your strategy.</p>
          <a
            href="/settings/ai-profile"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Go to AI Profile
            <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">AI Strategy</h1>
              <p className="mt-2 text-slate-600">
                Your complete marketing playbook. Aigeon uses this to write personalized messages.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-emerald-600 text-sm font-semibold"
                >
                  <Check className="w-4 h-4" />
                  Saved
                </motion.div>
              )}
              {isCached && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  <Zap className="w-3.5 h-3.5" />
                  Served from cache
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRegenerate(false)}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                  title="Regenerate (uses cache if available)"
                >
                  <RotateCcw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  onClick={() => handleRegenerate(true)}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  title="Force regenerate (bypasses cache, may take 10-15 seconds)"
                >
                  <Sparkles className="w-4 h-4" />
                  Force
                </button>
              </div>
            </div>
          </div>

          {generatedAt && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Generated {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString()}
            </div>
          )}

          {isFallback && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              This is a fallback strategy. Complete your AI Profile for a personalized strategy.
            </div>
          )}

          {rateLimitError && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              {rateLimitError}
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map(section => {
            const value = strategy[section.key];
            const isExpanded = expandedSections[section.key];
            const isEditing = editMode[section.key];

            return (
              <motion.div
                key={section.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{section.icon}</span>
                    <span className="font-bold text-slate-900">{section.label}</span>
                    {!value && <span className="text-xs text-slate-400">(empty)</span>}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                        {section.key === 'messagingPillars' && Array.isArray(value) ? (
                          <PillarEditor
                            pillars={value}
                            onSave={handlePillarSave}
                            saving={pillarSaving}
                          />
                        ) : isEditing ? (
                          <div>
                            <textarea
                              value={editValues[section.key] || ''}
                              onChange={e => setEditValues(prev => ({ ...prev, [section.key]: e.target.value }))}
                              className="w-full h-64 px-4 py-3 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                            />
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => saveEdit(section.key)}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                Save
                              </button>
                              <button
                                onClick={() => setEditMode(prev => ({ ...prev, [section.key]: false }))}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm leading-relaxed">
                              {renderValue(value)}
                            </div>
                            {section.key !== 'messagingPillars' && (
                              <button
                                onClick={() => startEdit(section.key)}
                                className="mt-3 text-xs text-primary font-semibold hover:underline"
                              >
                                Edit this section
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
