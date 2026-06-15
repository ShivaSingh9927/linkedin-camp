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

export function StrategyWorkspace({ embedded = false }: { embedded?: boolean }) {
  const [strategy, setStrategy] = useState<any>(null);
  // Master-detail: which section the right panel shows. 'summary' is the
  // read-only at-a-glance overview; the rest map to editable strategy keys.
  const [activeSection, setActiveSection] = useState<string>('summary');
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

  // ── Derived summary ("at a glance") data ──────────────────────────────────
  const positioning: string | undefined = strategy?.gtm?.positioning;
  const icp = strategy?.icp?.primary || {};
  const icpTitle: string | undefined = icp?.title;
  const pains: string[] = Array.isArray(icp?.painPoints) ? icp.painPoints.slice(0, 3) : [];
  const advantages: string[] = Array.isArray(strategy?.competitiveLandscape?.ourAdvantages) ? strategy.competitiveLandscape.ourAdvantages.slice(0, 3) : [];
  const pillars: any[] = Array.isArray(strategy?.messagingPillars) ? strategy.messagingPillars.slice(0, 3) : [];

  const confirmedCount = SECTIONS.filter((s) => confirmedSections[s.key]).length;
  const allConfirmed = !!confirmedAt || confirmedCount === SECTIONS.length;

  // Left-rail items: a read-only "Summary" first, then the editable sections.
  const NAV = [{ key: 'summary', label: 'Summary', icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10' }, ...SECTIONS] as const;
  const active = NAV.find((n) => n.key === activeSection) || NAV[0];
  const ActiveIcon = active.icon;

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      <div className={embedded ? '' : 'max-w-[1760px] mx-auto px-6 lg:px-10 py-12'}>
        {/* Header — title/info on the left, the confirm nudge fills the middle,
            and the Regenerate/Confirm actions sit on the right, all in one row. */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-9">
          <div className="flex-shrink-0">
            {!embedded && <h1 className="text-4xl lg:text-[2.75rem] font-black text-slate-900 tracking-tight leading-none">AI Strategy</h1>}
            {!embedded && <p className="mt-3.5 text-[17px] text-slate-600 font-medium max-w-2xl leading-relaxed">Your marketing playbook. Aigeon writes every message from this — review &amp; confirm so it sounds like you.</p>}
            {generatedAt && (
              <div className={cn('flex items-center gap-2 text-[13px] font-bold text-slate-400', !embedded && 'mt-3.5')}>
                <Clock className="w-4 h-4" /> Generated {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString()}
                {savedFlash && <span className="ml-2 inline-flex items-center gap-1 text-emerald-600"><Check className="w-4 h-4" /> Saved</span>}
                {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>
            )}
          </div>

          {/* Confirm nudge — inline in the header row */}
          {!allConfirmed && !nudgeDismissed && !isFallback && (
            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-fuchsia-50/60 px-4 py-2.5">
              <span className="w-7 h-7 rounded-lg bg-white shadow-[0_0_0_1px_rgba(124,92,252,.12)] grid place-items-center flex-shrink-0"><Sparkles className="w-4 h-4 text-primary" /></span>
              <p className="text-[13px] font-semibold text-slate-700 leading-snug min-w-0">Review each section and mark it <span className="text-primary font-extrabold">Looks good</span>. <span className="font-black whitespace-nowrap">{confirmedCount}/{SECTIONS.length} done.</span></p>
              <button onClick={() => setNudgeDismissed(true)} className="ml-auto text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 flex-shrink-0">Dismiss</button>
            </div>
          )}

          <div className="flex items-center gap-3 flex-shrink-0">
            {isCached && <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl"><Zap className="w-3.5 h-3.5" /> Cached</div>}
            <button onClick={() => handleRegenerate(false)} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 rounded-[16px] text-[14px] font-extrabold shadow-[0_1px_0_rgba(15,23,42,.04),0_0_0_1px_rgb(226,232,240)] hover:bg-slate-50 transition-colors whitespace-nowrap" title="Regenerate">
              <RotateCcw className="w-[18px] h-[18px]" /> Regenerate
            </button>
            <button
              onClick={confirmAll}
              className={cn('flex items-center gap-2 px-5 py-3 rounded-[16px] text-[14px] font-black transition-all whitespace-nowrap',
                allConfirmed ? 'bg-emerald-500 text-white shadow-[0_10px_24px_-8px_rgba(16,185,129,.6)]' : 'bg-gradient-to-br from-primary to-primary/90 text-white shadow-[0_10px_24px_-8px_rgba(124,92,252,.6)] hover:brightness-105')}
            >
              {allConfirmed ? <><CheckCircle2 className="w-[18px] h-[18px]" /> Confirmed</> : <><Check className="w-[18px] h-[18px]" /> Confirm strategy</>}
            </button>
          </div>
        </div>

        {isFallback && (
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl"><AlertCircle className="w-4 h-4" /> This is a fallback strategy. Complete your AI Profile for a personalized one.</div>
        )}
        {rateLimitError && (
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl"><Clock className="w-4 h-4" /> {rateLimitError}</div>
        )}

        {/* Master-detail: left rail + single-section panel (no scroll) */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-10 items-start">
          {/* LEFT RAIL */}
          <aside className="lg:sticky lg:top-8">
            <nav className="bg-white rounded-[28px] p-[18px] shadow-[0_1px_0_rgba(15,23,42,.04),0_0_0_1px_rgb(226,232,240)]">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.16em] px-3.5 pt-2.5 pb-3.5">Sections</p>
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                const isConfirmed = item.key !== 'summary' && !!confirmedSections[item.key];
                return (
                  <button key={item.key} onClick={() => setActiveSection(item.key)}
                    className={cn('group flex items-center gap-3.5 w-full text-left px-4 py-4 rounded-2xl text-[16px] font-bold transition-all',
                      isActive ? 'bg-gradient-to-br from-primary/10 to-fuchsia-50 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>
                    <span className={cn('w-[34px] h-[34px] rounded-xl grid place-items-center flex-shrink-0 transition-colors',
                      isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:text-primary')}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <span className="truncate">{item.label}</span>
                    {item.key !== 'summary' && (
                      <span className={cn('ml-auto w-5 h-5 rounded-full grid place-items-center flex-shrink-0 border-2 transition-colors',
                        isConfirmed ? 'border-emerald-500 bg-emerald-500' : isActive ? 'border-primary/40' : 'border-slate-300')}>
                        {isConfirmed && <Check className="w-3 h-3 text-white stroke-[3.5]" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* DETAIL PANEL */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeSection}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                className="bg-white rounded-[32px] shadow-[0_1px_0_rgba(15,23,42,.04),0_0_0_1px_rgb(226,232,240)] px-8 lg:px-12 py-10 lg:py-12 min-h-[600px]">
                {/* Panel header — icon is a hanging marker so the title left-aligns
                    with the body content below it (one clean left edge). */}
                <div className="flex items-start gap-4 mb-9">
                  <span className={cn('w-12 h-12 rounded-[16px] grid place-items-center flex-shrink-0',
                    activeSection === 'summary' ? 'bg-gradient-to-br from-primary/10 to-fuchsia-50 text-primary' : cn(active.bg, active.color))}>
                    <ActiveIcon className="w-6 h-6" />
                  </span>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight pt-1.5 min-w-0">{active.label}</h2>
                  {activeSection !== 'summary' && (
                    <button onClick={() => toggleConfirm(activeSection)}
                      className={cn('ml-auto flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black transition-all flex-shrink-0',
                        confirmedSections[activeSection] ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                      {confirmedSections[activeSection] ? <><CheckCircle2 className="w-4 h-4" /> Looks good</> : <><Check className="w-4 h-4" /> Mark good</>}
                    </button>
                  )}
                </div>

                {/* Panel body — indented to align under the title (icon width + gap). */}
                <div className="lg:pl-16">
                {activeSection === 'summary' ? (
                  <SummaryView positioning={positioning} icpTitle={icpTitle} pains={pains} advantages={advantages} pillars={pillars} isFallback={isFallback} />
                ) : activeSection === 'messagingPillars' ? (
                  <PillarEditor pillars={Array.isArray(strategy.messagingPillars) ? strategy.messagingPillars : []} onSave={handlePillarSave} saving={pillarSaving} />
                ) : activeSection === 'commentStrategy' ? (
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
                  <StrategySectionEditor sectionKey={activeSection} value={strategy[activeSection]} onChange={(next) => patchSection(activeSection, next)} />
                )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Summary ("at a glance") — read-only overview derived from the strategy ──
function SummaryView({ positioning, icpTitle, pains, advantages, pillars, isFallback }: {
  positioning?: string; icpTitle?: string; pains: string[]; advantages: string[]; pillars: any[]; isFallback: boolean;
}) {
  if (isFallback || (!positioning && !icpTitle && pillars.length === 0)) {
    return <p className="text-base text-slate-400 italic">Your overview will appear here once a personalized strategy is generated.</p>;
  }
  return (
    <div>
      {positioning && <p className="text-2xl font-extrabold tracking-tight text-slate-900 leading-[1.5] mb-10">{positioning}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {icpTitle && (
          <div className="rounded-3xl bg-slate-50 border border-slate-100 p-7">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.13em] mb-4">You target</p>
            <p className="text-lg font-black text-slate-900 mb-4">{icpTitle}</p>
            {pains.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {pains.map((p, i) => <span key={i} className="flex items-start gap-2 text-[15px] font-semibold text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 flex-shrink-0" /> {p}</span>)}
              </div>
            )}
          </div>
        )}
        {advantages.length > 0 && (
          <div className="rounded-3xl bg-slate-50 border border-slate-100 p-7">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.13em] mb-4">Your edge</p>
            <div className="flex flex-col gap-3 items-start">
              {advantages.map((a, i) => <span key={i} className="text-[15px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">{a}</span>)}
            </div>
          </div>
        )}
        {pillars.length > 0 && (
          <div className="rounded-3xl bg-slate-50 border border-slate-100 p-7">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.13em] mb-4">How you&apos;ll show up</p>
            <div className="flex flex-col gap-2.5">
              {pillars.map((p, i) => <span key={i} className="flex items-start gap-2 text-[15px] font-semibold text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" /> {p?.pillar || p?.name || `Pillar ${i + 1}`}</span>)}
            </div>
          </div>
        )}
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
