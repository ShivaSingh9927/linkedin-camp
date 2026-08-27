'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Clock, RotateCcw, Loader2, AlertCircle, Check, Zap,
  Target, Users, MessageCircle, Crosshair, Shield, Swords, MessageSquare,
  CheckCircle2, ArrowRight, X,
} from 'lucide-react';
import { io as socketIO, Socket } from 'socket.io-client';
import { GenerationProgress } from '@/components/GenerationProgress';
import PillarEditor from '@/components/PillarEditor';
import StrategySectionEditor from '@/components/StrategySectionEditor';
import { getStrategyLabels } from '@/lib/strategyLabels';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');

// Icon/colour per section is goal-independent; the visible label is resolved
// per goalType at render via getStrategyLabels (see SECTIONS in the component).
const SECTION_META = [
  { key: 'gtm', icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'icp', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { key: 'messagingPillars', icon: MessageCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { key: 'outreachAngles', icon: Crosshair, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { key: 'objections', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { key: 'competitiveLandscape', icon: Swords, color: 'text-slate-600', bg: 'bg-slate-500/10' },
  { key: 'commentStrategy', icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
] as const;

export function StrategyWorkspace({ embedded = false, goalType: goalTypeProp }: { embedded?: boolean; goalType?: string }) {
  const [strategy, setStrategy] = useState<any>(null);
  // What the user is on Qampi to do — drives all visible strategy labels.
  // When a parent owns the goal (the AI Profile page), its prop wins so the
  // labels + stale check update the instant the user switches goal; otherwise
  // we fall back to the goal fetched alongside the strategy.
  const [fetchedGoalType, setFetchedGoalType] = useState<string>('sell');
  const goalType = goalTypeProp ?? fetchedGoalType;
  // Card gallery: which section's editor drawer is open (null = gallery only).
  const [openKey, setOpenKey] = useState<string | null>(null);
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
  // Epoch ms when this generation actually began (persisted), so the progress
  // timeline resumes from real elapsed time across navigation/reloads.
  const [genStartedAt, setGenStartedAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Resume mid-generation either from the ?generating=1 hand-off (standalone
    // route) or from the persisted flag (embedded tab, where there's no param).
    const fromParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('generating') === '1';
    let flagTs = 0;
    try { flagTs = Number(localStorage.getItem('qampi_strategy_generating')) || 0; } catch { /* ignore */ }
    const flagFresh = flagTs > 0 && Date.now() - flagTs < 5 * 60 * 1000;
    if (fromParam || flagFresh) {
      // The strategy currently in the DB (if any) is the pre-regeneration one —
      // record it as the baseline so the poller fires only when a genuinely new
      // strategy lands. Resume the timeline from when generation really started.
      regenBaselineRef.current = generatedAt;
      let ts = flagTs;
      if (!ts) { ts = Date.now(); try { localStorage.setItem('qampi_strategy_generating', String(ts)); } catch { /* ignore */ } }
      setGenStartedAt(ts);
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
          if (data.goalType) setFetchedGoalType(data.goalType);
          setGeneratedAt(data.generatedAt);
          setIsFallback(data.strategy?._metadata?.isFallback || false);
          setIsCached(false);
          setConfirmedAt(data.confirmedAt || null);
          setConfirmedSections((data.confirmedSections as Record<string, boolean>) || {});
          setRegenerating(false);
          try { localStorage.removeItem('qampi_strategy_generating'); } catch { /* ignore */ }
        }
      } catch (e) {
        console.error('Strategy poll failed', e);
      }
      if (attempts >= MAX_ATTEMPTS) {
        setRegenerating(false);
        try { localStorage.removeItem('qampi_strategy_generating'); } catch { /* ignore */ }
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
      try { localStorage.removeItem('qampi_strategy_generating'); } catch { /* ignore */ }
      if (payload?.success && payload.strategy) {
        setStrategy(payload.strategy);
        setGeneratedAt(new Date().toISOString());
        setIsFallback(payload.strategy?._metadata?.isFallback || false);
        setIsCached(false);
        setConfirmedAt(null);
        setConfirmedSections({});
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
      if (data.goalType) setFetchedGoalType(data.goalType);
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
    const ts = Date.now();
    setGenStartedAt(ts);
    try { localStorage.setItem('qampi_strategy_generating', String(ts)); } catch { /* ignore */ }
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
  // When embedded as a tab the page shell (sidebar/header/padding) is already
  // present, so we drop the full-bleed `min-h-screen bg-slate-50` wrappers.
  const shell = embedded ? 'min-h-[420px] flex items-center justify-center' : 'min-h-screen bg-slate-50 flex items-center justify-center';
  if (loading) {
    return <div className={shell}><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }
  if (regenerating) {
    return (
      <div className={cn('flex items-center justify-center px-4 py-12', embedded ? 'min-h-[420px]' : 'min-h-[calc(100vh-72px)] bg-slate-50')}>
        <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/60 px-12 py-14">
          <GenerationProgress active variant="light" startedAt={genStartedAt} />
        </div>
      </div>
    );
  }
  if (!strategy) {
    return (
      <div className={shell}>
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Strategy Yet</h2>
          <p className="text-slate-500 mb-6">Generate your AI strategy from your business profile.</p>
          <button onClick={() => handleRegenerate(false)} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Sparkles className="w-4 h-4" /> Generate strategy
          </button>
          {rateLimitError && <p className="mt-4 text-sm font-semibold text-amber-600">{rateLimitError}</p>}
        </div>
      </div>
    );
  }

  // ── Derived "at a glance" data (the positioning band) ─────────────────────
  const positioning: string | undefined = strategy?.gtm?.positioning;
  const advantages: string[] = Array.isArray(strategy?.competitiveLandscape?.ourAdvantages) ? strategy.competitiveLandscape.ourAdvantages.slice(0, 3) : [];

  // Visible labels are resolved per goal; the section keys/icons never change.
  const labels = getStrategyLabels(goalType);
  const SECTIONS = SECTION_META.map((s) => ({ ...s, label: labels.sections[s.key] || s.key }));

  // Stale check: the strategy stamps the goal it was generated for. If the user
  // has since switched goals, the current strategy no longer fits — flag it and
  // prompt a regenerate (we never auto-wipe their inputs or strategy).
  const GOAL_LABELS: Record<string, string> = {
    sell: 'Generate leads', recruiting: 'Hire talent', job_seeking: 'Find a job',
    fundraising: 'Raise funding', networking: 'Grow my network',
  };
  const strategyGoal = strategy?._metadata?.goalType || 'sell';
  const isStaleGoal = !!strategy && !isFallback && !regenerating && strategyGoal !== goalType;

  const confirmedCount = SECTIONS.filter((s) => confirmedSections[s.key]).length;
  const allConfirmed = !!confirmedAt || confirmedCount === SECTIONS.length;

  // The section whose editor drawer is open, and its icon.
  const openMeta = openKey ? SECTIONS.find((s) => s.key === openKey) || null : null;
  const OpenIcon = openMeta?.icon || Sparkles;

  // A short, human-readable preview of each section for its gallery card.
  const snippetFor = (key: string): string => {
    // strategy is `any`; keep v permissive so each section's varied shape reads cleanly.
    const v: any = strategy?.[key]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!v || (typeof v === 'object' && Object.keys(v).length === 0)) return 'Not generated yet — open to add detail.';
    switch (key) {
      case 'gtm':
        return v.positioning || [v.salesMotion, v.primaryChannel].filter(Boolean).join(' · ') || 'Your go-to-market motion and positioning.';
      case 'icp': {
        const p = v.primary || {};
        const pains = Array.isArray(p.painPoints) ? p.painPoints.slice(0, 2).join(', ') : '';
        const head = [p.title, p.companySize].filter(Boolean).join(' · ');
        return [head, pains].filter(Boolean).join(' — ') || 'Your ideal customer profile.';
      }
      case 'messagingPillars': {
        const arr = Array.isArray(v) ? v : [];
        return arr.map((p) => p?.pillar || p?.name).filter(Boolean).slice(0, 3).join(' · ') || 'Your core messaging pillars.';
      }
      case 'outreachAngles': {
        const entries = v && typeof v === 'object' ? Object.entries(v) : [];
        const first = entries[0]?.[1] as { hook?: string } | undefined;
        const personas = entries.map(([k]) => k.replace(/([A-Z])/g, ' $1').trim()).slice(0, 3).join(', ');
        return first?.hook || personas || 'Persona-specific outreach hooks.';
      }
      case 'objections': {
        const entries = v && typeof v === 'object' ? Object.entries(v) : [];
        const first = entries[0]?.[1] as { response?: string } | undefined;
        return first?.response || (entries.length ? `${entries.length} common objections handled.` : 'How to handle pushback.');
      }
      case 'competitiveLandscape': {
        const adv = Array.isArray(v.ourAdvantages) ? v.ourAdvantages.slice(0, 3).join(', ') : '';
        const comp = Array.isArray(v.directCompetitors) ? v.directCompetitors.slice(0, 3).join(', ') : '';
        return adv || (comp ? `Vs. ${comp}` : '') || 'Where you win and how to position.';
      }
      case 'commentStrategy':
        return v.goal || v.approach || 'How Aigeon comments on prospects’ posts.';
      default:
        return 'Open to review this section.';
    }
  };

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      <div className={embedded ? '' : 'max-w-[1240px] mx-auto px-6 lg:px-10 py-12'}>
        {/* Action bar — progress ring + generated info on the left,
            Regenerate / Confirm strategy on the right. */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-[46px] h-[46px] rounded-full grid place-items-center shrink-0"
              style={{ background: `conic-gradient(#8b5cf6 ${Math.round((confirmedCount / Math.max(SECTIONS.length, 1)) * 100)}%, #e9e7f7 0)` }}
            >
              <div className="w-9 h-9 rounded-full bg-white grid place-items-center text-[12px] font-black text-slate-700">{confirmedCount}/{SECTIONS.length}</div>
            </div>
            <div className="min-w-0">
              {embedded
                ? <div className="text-[15px] font-black text-slate-900 tracking-tight leading-none">Your strategy playbook</div>
                : <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-none">AI Strategy</h1>}
              {generatedAt && (
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 mt-1.5">
                  <Clock className="w-3.5 h-3.5" /> Generated {new Date(generatedAt).toLocaleDateString()} · review each card below
                  {savedFlash && <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-600"><Check className="w-3.5 h-3.5" /> Saved</span>}
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isCached && <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-control"><Zap className="w-3.5 h-3.5" /> Cached</div>}
            <button onClick={() => handleRegenerate(false)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-control text-[14px] font-extrabold border border-slate-200 shadow-[0_1px_0_rgba(15,23,42,.03)] hover:bg-slate-50 transition-colors whitespace-nowrap" title="Regenerate">
              <RotateCcw className="w-[17px] h-[17px]" /> Regenerate
            </button>
            <button
              onClick={confirmAll}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-control text-[14px] font-black transition-all whitespace-nowrap',
                allConfirmed ? 'bg-emerald-500 text-white shadow-[0_10px_24px_-8px_rgba(16,185,129,.6)]' : 'bg-gradient-to-br from-primary to-primary/90 text-white shadow-[0_10px_24px_-8px_rgba(124,92,252,.6)] hover:brightness-105')}
            >
              {allConfirmed ? <><CheckCircle2 className="w-[17px] h-[17px]" /> Confirmed</> : <><Check className="w-[17px] h-[17px]" /> Confirm strategy</>}
            </button>
          </div>
        </div>

        {isFallback && (
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl"><AlertCircle className="w-4 h-4" /> This is a fallback strategy. Complete your AI Profile for a personalized one.</div>
        )}
        {rateLimitError && (
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl"><Clock className="w-4 h-4" /> {rateLimitError}</div>
        )}
        {isStaleGoal && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 flex-1">
              This strategy was built for <span className="font-black">{GOAL_LABELS[strategyGoal] || strategyGoal}</span>. You’ve switched to <span className="font-black">{GOAL_LABELS[goalType] || goalType}</span> — review your inputs and regenerate to refresh it.
            </p>
            <button onClick={() => handleRegenerate(false)} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors">
              <RotateCcw className="w-4 h-4" /> Regenerate
            </button>
          </div>
        )}

        {/* Positioning band — the one-line "at a glance" hook. */}
        {positioning && !isFallback && (
          <div className="mt-4 flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-gradient-to-r from-primary/[0.07] to-fuchsia-50/50 px-5 py-3.5">
            <span className="w-9 h-9 rounded-xl bg-white shadow-[0_0_0_1px_rgba(124,92,252,.14)] grid place-items-center shrink-0"><Sparkles className="w-[18px] h-[18px] text-primary" /></span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-black text-primary uppercase tracking-[0.14em]">Positioning</p>
              <p className="text-[16px] font-extrabold text-slate-900 leading-snug mt-0.5">{positioning}</p>
            </div>
            {advantages.length > 0 && (
              <div className="ml-auto hidden md:flex items-center gap-2 shrink-0">
                {advantages.map((a, i) => <span key={i} className="text-[12.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap">{a}</span>)}
              </div>
            )}
          </div>
        )}

        {/* Section gallery — click a card to open its editor drawer. */}
        <p className="text-[11.5px] font-black text-slate-400 uppercase tracking-[0.14em] mt-6 mb-3">{SECTIONS.length} sections · click any card to review &amp; edit</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const done = !!confirmedSections[s.key];
            return (
              <button
                key={s.key}
                onClick={() => setOpenKey(s.key)}
                className={cn('group relative flex flex-col text-left rounded-card border p-[18px] min-h-[168px] transition-all hover:-translate-y-0.5',
                  done ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.045] to-transparent' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,.35)]')}
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-slate-100 text-slate-500 group-hover:text-primary transition-colors"><Icon className="w-5 h-5" /></span>
                  <h3 className="text-[15.5px] font-extrabold text-slate-900 tracking-tight flex-1 min-w-0 truncate">{s.label}</h3>
                  <span className={cn('w-6 h-6 rounded-full grid place-items-center shrink-0 border-2 transition-colors', done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-transparent')}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                </div>
                <p className="mt-3.5 text-[13.5px] leading-relaxed text-slate-600 font-medium line-clamp-3">{snippetFor(s.key)}</p>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className={cn('text-[12px] font-bold inline-flex items-center gap-1.5', done ? 'text-emerald-600' : 'text-slate-400')}>
                    {done ? <><CheckCircle2 className="w-3.5 h-3.5" /> Looks good</> : <><AlertCircle className="w-3.5 h-3.5" /> Needs review</>}
                  </span>
                  <span className="text-[12.5px] font-bold text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Review <ArrowRight className="w-3 h-3" /></span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section editor drawer — hosts the existing per-section editors. */}
      <AnimatePresence>
        {openMeta && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpenKey(null)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              className="fixed top-0 right-0 z-50 h-full w-[min(560px,94vw)] bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
                <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 grid place-items-center shrink-0"><OpenIcon className="w-5 h-5" /></span>
                <h3 className="text-[18px] font-black text-slate-900 tracking-tight flex-1 min-w-0 truncate">{openMeta.label}</h3>
                <button
                  onClick={() => toggleConfirm(openMeta.key)}
                  className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-control text-[13px] font-black transition-all',
                    confirmedSections[openMeta.key] ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  {confirmedSections[openMeta.key] ? <><CheckCircle2 className="w-4 h-4" /> Looks good</> : <><Check className="w-4 h-4" /> Mark good</>}
                </button>
                <button onClick={() => setOpenKey(null)} aria-label="Close" className="w-9 h-9 rounded-control border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 shrink-0"><X className="w-[18px] h-[18px]" /></button>
              </div>

              <div className="flex-1 overflow-auto px-6 py-5 min-h-0">
                {openMeta.key === 'messagingPillars' ? (
                  <PillarEditor pillars={Array.isArray(strategy.messagingPillars) ? strategy.messagingPillars : []} onSave={handlePillarSave} saving={pillarSaving} />
                ) : openMeta.key === 'commentStrategy' ? (
                  <CommentStrategyEditor
                    value={strategy.commentStrategy}
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
                  <StrategySectionEditor sectionKey={openMeta.key} value={strategy[openMeta.key]} goalType={goalType} onChange={(next) => patchSection(openMeta.key, next)} />
                )}
              </div>

              <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
                <span className="text-[12.5px] font-bold text-slate-400 mr-auto inline-flex items-center gap-1.5">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : savedFlash ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Saved</> : 'Edits save automatically'}
                </span>
                <button onClick={() => setOpenKey(null)} className="px-4 py-2.5 rounded-control text-[13.5px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">Close</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
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
