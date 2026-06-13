'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Clock, RotateCcw, Loader2, AlertCircle, Check, Zap,
  Target, Users, MessageCircle, Crosshair, Shield, Swords, MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { io as socketIO, Socket } from 'socket.io-client';
import { GenerationProgress } from '@/components/GenerationProgress';
import PillarEditor from '@/components/PillarEditor';
import StrategySectionEditor from '@/components/StrategySectionEditor';
import { SectionRail } from '@/components/ui/section-rail';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');

const SECTIONS = [
  { key: 'gtm', label: 'Go-to-Market', icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'icp', label: 'Ideal Customer', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { key: 'messagingPillars', label: 'Messaging Pillars', icon: MessageCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { key: 'outreachAngles', label: 'Outreach Angles', icon: Crosshair, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { key: 'objections', label: 'Objection Handling', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { key: 'competitiveLandscape', label: 'Competitive Landscape', icon: Swords, color: 'text-slate-600', bg: 'bg-slate-500/10' },
  { key: 'commentStrategy', label: 'Comment Strategy', icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
] as const;

export default function StrategyPage() {
  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Confirmation (soft).
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [confirmedSections, setConfirmedSections] = useState<Record<string, boolean>>({});
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Comment strategy sub-editor.
  const [pillarSaving, setPillarSaving] = useState(false);
  const [commentInstruction, setCommentInstruction] = useState('');
  const [editCommentInstruction, setEditCommentInstruction] = useState('');
  const [commentSuggesting, setCommentSuggesting] = useState(false);
  const [commentSuggestion, setCommentSuggestion] = useState<string | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  // Baseline generatedAt captured when regeneration starts; polling compares
  // against it to detect a fresh result even if the socket event is missed.
  const regenBaselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('generating') === '1') {
      // Arrived mid-generation (from AI Profile). The strategy currently in the
      // DB (if any) is the pre-regeneration one — record it as the baseline so
      // the poller fires only when a genuinely new strategy lands.
      regenBaselineRef.current = generatedAt;
      setRegenerating(true);
    }
    loadStrategy();
    loadCommentInstruction();
  }, []);

  // Polling backstop for the loading state. The backend signals completion via
  // the STRATEGY_GENERATED socket event, but that emit is fire-and-forget and
  // is LOST if the client socket happens to be mid-reconnect when it fires
  // (Socket.IO doesn't buffer room emits for disconnected clients, and the dev
  // server churns sockets via HMR). So while `regenerating`, poll GET /strategy
  // every 5s and exit the moment a strategy newer than the baseline appears —
  // the UI recovers regardless of whether the socket event ever lands.
  useEffect(() => {
    if (!regenerating) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 96; // 96 × 2.5s = 4 min ceiling
    const id = setInterval(async () => {
      attempts += 1;
      try {
        const { data } = await api.get('/strategy');
        const fresh = data?.strategy && data.generatedAt && data.generatedAt !== regenBaselineRef.current;
        if (fresh) {
          setStrategy(data.strategy);
          setGeneratedAt(data.generatedAt);
          setIsFallback(data.strategy?._metadata?.isFallback || false);
          setIsCached(false);
          setConfirmedAt(data.confirmedAt || null);
          setConfirmedSections((data.confirmedSections as Record<string, boolean>) || {});
          setRegenerating(false);
        }
      } catch (e) {
        console.error('Strategy poll failed', e);
      }
      if (attempts >= MAX_ATTEMPTS) {
        setRegenerating(false);
        setRateLimitError('Strategy is taking longer than expected. Please refresh to check.');
      }
    }, 2500);
    return () => clearInterval(id);
  }, [regenerating]);

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
        setConfirmedAt(null);
        setConfirmedSections({});
        setNudgeDismissed(false);
      } else if (payload?.status === 'rate_limited') {
        setRateLimitError(payload.error || 'Rate limit exceeded.');
      } else {
        setRateLimitError(payload?.error || 'Strategy generation failed.');
      }
    });
    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  const loadStrategy = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/strategy');
      if (data.strategy) {
        setStrategy(data.strategy);
        setGeneratedAt(data.generatedAt);
        setIsFallback(data.strategy._metadata?.isFallback || false);
        setConfirmedAt(data.confirmedAt || null);
        setConfirmedSections((data.confirmedSections as Record<string, boolean>) || {});
      }
      // Seed the regeneration baseline with the currently-persisted timestamp so
      // the polling backstop fires only when a NEW strategy lands (not on the
      // pre-existing one). Only seed if not already mid-regeneration.
      if (!regenerating) regenBaselineRef.current = data.generatedAt || null;
    } catch (e) {
      console.error('Failed to load strategy', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCommentInstruction = async () => {
    try {
      const { data } = await api.get('/strategy/comment-instruction');
      if (data.instruction) setCommentInstruction(data.instruction);
    } catch (e) { console.error('Failed to load comment instruction', e); }
  };

  // Persist a single section's new value (no JSON — comes from the inline editors).
  const flashSaved = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000); };
  const patchSection = async (key: string, nextValue: any) => {
    setStrategy((prev: any) => ({ ...prev, [key]: nextValue }));
    setSaving(true);
    try {
      await api.put('/strategy', { overrides: { [key]: nextValue } });
      flashSaved();
    } catch (e) { console.error('Failed to save section', e); }
    finally { setSaving(false); }
  };

  const handlePillarSave = async (updated: any[]) => {
    setPillarSaving(true);
    try {
      setStrategy((prev: any) => ({ ...prev, messagingPillars: updated }));
      await api.put('/strategy', { overrides: { messagingPillars: updated } });
      flashSaved();
    } catch (e) { console.error('Failed to save pillars', e); }
    finally { setPillarSaving(false); }
  };

  const toggleConfirm = async (key: string) => {
    const next = !confirmedSections[key];
    setConfirmedSections((prev) => ({ ...prev, [key]: next }));
    try {
      const { data } = await api.post('/strategy/confirm', { section: key, confirmed: next });
      if (data?.confirmedSections) setConfirmedSections(data.confirmedSections);
    } catch (e) { console.error('Failed to toggle confirm', e); }
  };

  const confirmAll = async () => {
    try {
      const { data } = await api.post('/strategy/confirm', { all: true });
      setConfirmedAt(data?.confirmedAt || new Date().toISOString());
      // also mark every visible section confirmed for the rail dots
      const all: Record<string, boolean> = {};
      SECTIONS.forEach((s) => { all[s.key] = true; });
      setConfirmedSections(all);
      await Promise.all(SECTIONS.map((s) => api.post('/strategy/confirm', { section: s.key, confirmed: true })));
    } catch (e) { console.error('Failed to confirm strategy', e); }
  };

  const handleRegenerate = async (force = false) => {
    regenBaselineRef.current = generatedAt; // current strategy is the "before"
    setRegenerating(true);
    setRateLimitError(null);
    try {
      await api.post('/strategy/generate', { trigger: 'manual', force_regenerate: force });
    } catch (e: any) {
      if (e?.response?.status === 429) setRateLimitError(e.response.data?.error || 'Rate limit exceeded.');
      else { console.error('Failed to regenerate', e); setRateLimitError('Failed to regenerate strategy.'); }
      setRegenerating(false);
    }
  };

  const handleSuggestComment = async () => {
    if (!editCommentInstruction.trim()) return;
    setCommentSuggesting(true); setCommentSuggestion(null);
    try {
      const { data } = await api.post('/strategy/edit-comment-style', { instruction: editCommentInstruction.trim() });
      setCommentSuggestion(data.suggested_instruction);
    } catch (e) { console.error('Failed to suggest comment style', e); }
    finally { setCommentSuggesting(false); }
  };

  const handleAcceptCommentInstruction = async () => {
    if (!commentSuggestion) return;
    setCommentSaving(true);
    try {
      await api.put('/strategy/comment-instruction', { instruction: commentSuggestion });
      setCommentInstruction(commentSuggestion);
      setEditCommentInstruction(''); setCommentSuggestion(null); flashSaved();
    } catch (e) { console.error('Failed to save comment instruction', e); }
    finally { setCommentSaving(false); }
  };

  // ── Loading / generating / empty states ──────────────────────────────────
  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }
  if (regenerating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/60 px-10 py-12">
          <GenerationProgress active variant="light" />
        </div>
      </div>
    );
  }
  if (!strategy) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Strategy Yet</h2>
          <p className="text-slate-500 mb-6">Complete your AI Profile and generate your strategy.</p>
          <a href="/settings/ai-profile" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">Go to AI Profile</a>
        </div>
      </div>
    );
  }

  // ── Derived bento data ────────────────────────────────────────────────────
  const positioning: string | undefined = strategy?.gtm?.positioning;
  const icp = strategy?.icp?.primary || {};
  const icpTitle: string | undefined = icp?.title;
  const pains: string[] = Array.isArray(icp?.painPoints) ? icp.painPoints.slice(0, 3) : [];
  const advantages: string[] = Array.isArray(strategy?.competitiveLandscape?.ourAdvantages) ? strategy.competitiveLandscape.ourAdvantages.slice(0, 3) : [];
  const pillars: any[] = Array.isArray(strategy?.messagingPillars) ? strategy.messagingPillars.slice(0, 3) : [];

  const confirmedCount = SECTIONS.filter((s) => confirmedSections[s.key]).length;
  const allConfirmed = !!confirmedAt || confirmedCount === SECTIONS.length;
  const railItems = SECTIONS.map((s) => ({ id: s.key, label: s.label, confirmed: !!confirmedSections[s.key] }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">AI Strategy</h1>
            <p className="mt-1.5 text-slate-600">Your marketing playbook. Aigeon writes every message from this — review &amp; confirm so it sounds like you.</p>
            {generatedAt && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" /> Generated {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString()}
                {savedFlash && <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-semibold"><Check className="w-3.5 h-3.5" /> Saved</span>}
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isCached && <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg"><Zap className="w-3.5 h-3.5" /> Cached</div>}
            <button onClick={() => handleRegenerate(false)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors" title="Regenerate">
              <RotateCcw className="w-4 h-4" /> Regenerate
            </button>
            <button
              onClick={confirmAll}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg',
                allConfirmed ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90')}
            >
              {allConfirmed ? <><CheckCircle2 className="w-4 h-4" /> Confirmed</> : <><Check className="w-4 h-4" /> Confirm strategy</>}
            </button>
          </div>
        </div>

        {isFallback && (
          <div className="mb-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg"><AlertCircle className="w-3.5 h-3.5" /> This is a fallback strategy. Complete your AI Profile for a personalized one.</div>
        )}
        {rateLimitError && (
          <div className="mb-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg"><Clock className="w-3.5 h-3.5" /> {rateLimitError}</div>
        )}

        {/* Confirm nudge */}
        <AnimatePresence>
          {!allConfirmed && !nudgeDismissed && !isFallback && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm font-bold text-slate-700">Review each section and mark it <span className="text-primary">Looks good</span> — the AI writes better when you&apos;ve confirmed your strategy. <span className="font-black">{confirmedCount}/{SECTIONS.length} done.</span></p>
              </div>
              <button onClick={() => setNudgeDismissed(true)} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex-shrink-0">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bento "at a glance" hero */}
        {!isFallback && (positioning || icpTitle || pillars.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/5 via-indigo-50/50 to-purple-50/40 p-6 sm:p-7 mb-8 shadow-soft">
            <Sparkles className="absolute -right-6 -top-6 w-32 h-32 text-primary/5" />
            <div className="relative">
              <p className="text-[11px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Your strategy at a glance</p>
              {positioning && <p className="text-base font-bold text-slate-800 leading-relaxed mb-5 max-w-3xl">{positioning}</p>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {icpTitle && (
                  <div className="md:col-span-1 bg-white/70 rounded-2xl p-4 border border-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">You target</p>
                    <p className="text-sm font-black text-slate-900">{icpTitle}</p>
                    {pains.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{pains.map((p, i) => <span key={i} className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">{p}</span>)}</div>}
                  </div>
                )}
                {advantages.length > 0 && (
                  <div className="bg-white/70 rounded-2xl p-4 border border-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Your edge</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">{advantages.map((a, i) => <span key={i} className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{a}</span>)}</div>
                  </div>
                )}
                {pillars.length > 0 && (
                  <div className="bg-white/70 rounded-2xl p-4 border border-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">How you&apos;ll show up</p>
                    <div className="space-y-1">{pillars.map((p, i) => <p key={i} className="text-xs font-bold text-slate-700 truncate">• {p?.pillar || `Pillar ${i + 1}`}</p>)}</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Rail + content */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-3">Sections</p>
              <SectionRail items={railItems} />
            </div>
          </aside>

          <div className="space-y-6 min-w-0">
            {SECTIONS.map((section) => {
              const value = strategy[section.key];
              const Icon = section.icon;
              const confirmed = !!confirmedSections[section.key];
              return (
                <section key={section.key} id={`sec-${section.key}`} className="scroll-mt-8">
                  <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
                    className="bg-white rounded-[1.75rem] border border-slate-200 shadow-soft overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', section.bg)}><Icon className={cn('w-5 h-5', section.color)} /></div>
                        <h3 className="font-black text-slate-900 tracking-tight truncate">{section.label}</h3>
                      </div>
                      <button onClick={() => toggleConfirm(section.key)}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all flex-shrink-0',
                          confirmed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                        {confirmed ? <><CheckCircle2 className="w-3.5 h-3.5" /> Looks good</> : <><Check className="w-3.5 h-3.5" /> Mark good</>}
                      </button>
                    </div>

                    {/* Section body */}
                    <div className="p-6">
                      {section.key === 'messagingPillars' ? (
                        <PillarEditor pillars={Array.isArray(value) ? value : []} onSave={handlePillarSave} saving={pillarSaving} />
                      ) : section.key === 'commentStrategy' ? (
                        <CommentStrategyEditor
                          value={value}
                          commentInstruction={commentInstruction}
                          editCommentInstruction={editCommentInstruction}
                          setEditCommentInstruction={setEditCommentInstruction}
                          commentSuggesting={commentSuggesting}
                          commentSuggestion={commentSuggestion}
                          setCommentSuggestion={setCommentSuggestion}
                          commentSaving={commentSaving}
                          onSuggest={handleSuggestComment}
                          onAccept={handleAcceptCommentInstruction}
                        />
                      ) : (
                        <StrategySectionEditor sectionKey={section.key} value={value} onChange={(next) => patchSection(section.key, next)} />
                      )}
                    </div>
                  </motion.div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Comment strategy editor (preserves the existing instruction-suggestion flow) ──
function CommentStrategyEditor(props: {
  value: any;
  commentInstruction: string;
  editCommentInstruction: string;
  setEditCommentInstruction: (v: string) => void;
  commentSuggesting: boolean;
  commentSuggestion: string | null;
  setCommentSuggestion: (v: string | null) => void;
  commentSaving: boolean;
  onSuggest: () => void;
  onAccept: () => void;
}) {
  const cs = props.value || {};
  return (
    <div className="space-y-4">
      {(cs.goal || cs.approach) && (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2">
          {cs.goal && <p className="text-sm text-slate-700"><span className="font-black text-slate-500 text-xs uppercase tracking-widest mr-1">Goal</span> {cs.goal}</p>}
          {cs.approach && <p className="text-sm text-slate-700"><span className="font-black text-slate-500 text-xs uppercase tracking-widest mr-1">Approach</span> {cs.approach}</p>}
          {Array.isArray(cs.topics) && cs.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">{cs.topics.map((t: string, i: number) => <span key={i} className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{t}</span>)}</div>
          )}
        </div>
      )}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-bold text-slate-500">Your comment style (optional)</div>
            <p className="text-xs text-slate-400 mt-0.5">Applied to every comment the AI writes.</p>
          </div>
          {props.commentInstruction && <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg"><Check className="w-3 h-3" /> Saved</div>}
        </div>
        <textarea
          value={props.editCommentInstruction}
          onChange={(e) => props.setEditCommentInstruction(e.target.value)}
          placeholder={props.commentInstruction || "e.g. After reading the post, share an insightful observation. Don't mention your company name."}
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <button onClick={props.onSuggest} disabled={props.commentSuggesting || !props.editCommentInstruction.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 disabled:opacity-50 transition-colors">
            {props.commentSuggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Preview revision
          </button>
        </div>
        {props.commentSuggestion && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
            <div className="text-sm leading-relaxed bg-slate-50 rounded-xl p-3">
              {props.commentInstruction && <div className="mb-2"><span className="text-xs text-slate-400">Before:</span><div className="text-xs text-slate-500 line-through">{props.commentInstruction}</div></div>}
              <div><span className="text-xs text-emerald-600 font-semibold">After:</span><div className="text-sm text-slate-700 mt-0.5">{props.commentSuggestion}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={props.onAccept} disabled={props.commentSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {props.commentSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept &amp; save
              </button>
              <button onClick={() => props.setCommentSuggestion(null)} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">Edit more</button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
