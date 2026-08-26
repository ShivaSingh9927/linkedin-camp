'use client';

// The activation copilot conversation engine — shared by the full-screen first-run
// takeover and the permanent dashboard panel. Layout-agnostic: it fills its
// container and drives the flow understand → recommend search → run search →
// results + import → recommend templates. `variant` only changes the opening
// behavior: 'fullscreen' auto-starts (understand card + search chips); 'panel'
// stays quiet until the user asks.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, ArrowUp, Check, Plus, MapPin, Clock, ArrowRight, Rocket, LinkIcon, Sparkles, PenSquare, Trash2, MessageSquare, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
    fetchUnderstand, fetchSearchRecommendations, runSearch, importPeople, fetchTemplateRecommendations,
    routeMessage, launchFromTemplate, fetchAvailableLeads, fetchTemplateHint, fetchProactiveContext,
    draftReply, sendReply,
    type Understand, type SearchRecommendation, type SearchPerson, type TemplatePick, type HistoryMsg, type LaunchOverrides, type TemplateHint, type ProactiveContext, type WaitingReply,
} from './copilotApi';
import { type Msg, nextId } from './copilotTypes';
import { useCopilot, type ThreadMeta } from './CopilotProvider';

// Ready-to-use prompts pinned above the composer, always reachable (not just on
// an empty thread). `send` is the text run through the router for free-text
// intents; 'search'/'campaign' short-circuit to the deterministic flows.
const QUICK_PROMPTS: { label: string; icon: typeof Search; action: 'search' | 'campaign' | 'status'; send: string }[] = [
    { label: 'Suggest searches', icon: Search, action: 'search', send: '' },
    { label: 'What campaign should I run?', icon: Rocket, action: 'campaign', send: '' },
    { label: 'Handle my replies', icon: MessageSquare, action: 'status', send: 'Handle the replies waiting on me.' },
    { label: 'How’s my campaign?', icon: ArrowRight, action: 'status', send: 'How is my campaign doing?' },
];

export function CopilotConversation({ variant, onClose }: { variant: 'fullscreen' | 'panel'; onClose?: () => void }) {
    // Conversation state is owned by the layout-level provider so it survives
    // route navigation and (via localStorage) reloads. This component is a view.
    const { messages, setMessages, importedLeadIds, setImportedLeadIds, hydrated,
        threads, activeThreadId, newThread, switchThread, deleteThread } = useCopilot();
    const [input, setInput] = useState('');
    const [threadMenuOpen, setThreadMenuOpen] = useState(false);
    // Guards a single mount from kicking off the opening flow twice (e.g. React
    // strict-mode double-invoke); the durable "have we started" signal is whether
    // the restored thread already has messages.
    const [started, setStarted] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const taRef = useRef<HTMLTextAreaElement | null>(null);
    // Leads this launch will run on — imported this session, mirrored from the
    // provider so callbacks can read the latest value synchronously.
    const importedLeadIdsRef = useRef<string[]>([]);
    importedLeadIdsRef.current = importedLeadIds;
    const messagesRef = useRef<Msg[]>([]);
    messagesRef.current = messages;
    // Lets doSearch (defined earlier) trigger a rotation without a forward ref cycle.
    const rotateAngleRef = useRef<(() => void) | null>(null);
    // The unanswered-reply queue for handle_replies — draft one card at a time.
    const repliesQueueRef = useRef<WaitingReply[]>([]);
    const replyIdxRef = useRef(0);

    // Compact history for the router (last several text turns only).
    const historyForRouter = useCallback((): HistoryMsg[] => {
        return messagesRef.current
            .filter((m): m is Extract<Msg, { kind: 'text' }> => m.kind === 'text')
            .slice(-8)
            .map((m) => ({ sender: m.role === 'user' ? 'you' : 'qampi', text: m.text }));
    }, []);

    const push = useCallback((m: Msg) => setMessages((prev) => [...prev, m]), []);
    const patch = useCallback((id: string, next: Partial<Msg>) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...next } as Msg) : m)));
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    // Auto-grow composer up to a cap.
    useEffect(() => {
        const el = taRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [input]);

    const loadSearchChips = useCallback(async () => {
        const chipId = nextId();
        push({ id: chipId, role: 'qampi', kind: 'searchChips', loading: true });
        try {
            const recs = await fetchSearchRecommendations();
            patch(chipId, { loading: false, recs });
        } catch {
            patch(chipId, { loading: false, recs: [] });
        }
    }, [push, patch]);

    // Full-screen opening: reflect understanding, then recommend searches.
    const start = useCallback(async () => {
        if (started) return;
        setStarted(true);
        track('copilot_opened', { variant });
        const uId = nextId();
        push({ id: uId, role: 'qampi', kind: 'understand', loading: true });
        try {
            const data = await fetchUnderstand();
            patch(uId, { loading: false, data });
        } catch {
            patch(uId, { loading: false, data: undefined });
        }
        push({ id: nextId(), role: 'qampi', kind: 'text', text: 'Here are searches I’d run to find your best-fit leads. Pick one and I’ll search LinkedIn for you.' });
        await loadSearchChips();
    }, [started, variant, push, patch, loadSearchChips]);

    // Auto-start only after hydration, and only if there's no restored thread —
    // a returning user sees their conversation, not a fresh "reading your profile…".
    useEffect(() => {
        if (variant === 'fullscreen' && hydrated && messages.length === 0) start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variant, hydrated]);

    const doSearch = useCallback(async (label: string, keywords: string, filters?: SearchRecommendation['filters'], page = 1) => {
        // Only echo the user's ask on the first page; "Show more" is a quiet continuation.
        if (page === 1) push({ id: nextId(), role: 'user', kind: 'text', text: label });
        const sId = nextId();
        push({ id: sId, role: 'qampi', kind: 'searching', label });
        try {
            // Dedup + saturation are now server-side (durable search memory), so the
            // returned people are already fresh and we get a mined-out signal back.
            const res = await runSearch(keywords, filters, page, label);
            track('copilot_search_run', { via: res.via, count: res.people.length, page, saturation: res.saturation?.state });
            setMessages((prev) => prev.filter((m) => m.id !== sId));
            const people = res.people;
            if (!people.length) {
                // Everything on this page was already seen/imported, or the vein is dry —
                // proactively propose a fresh angle (grounded on the tried-angles memory).
                push({
                    id: nextId(), role: 'qampi', kind: 'text',
                    text: page > 1
                        ? 'That’s everyone fresh for this angle — you’ve already seen the rest. Here’s a different angle to try:'
                        : 'You’ve already seen everyone this search turns up. Let me suggest a different angle:',
                });
                rotateAngleRef.current?.();
                return;
            }
            push({ id: nextId(), role: 'qampi', kind: 'text', text: page > 1 ? `Found ${people.length} more.` : `Found ${people.length} people. Pick the ones you want and I’ll import them.` });
            push({ id: nextId(), role: 'qampi', kind: 'results', people, via: res.via, remaining: res.remaining, cap: res.cap, keywords, filters, page, saturation: res.saturation });
        } catch (e) {
            setMessages((prev) => prev.filter((m) => m.id !== sId));
            const err = e as { response?: { status?: number; data?: { error?: string; message?: string } } };
            if (err?.response?.status === 419 || err?.response?.data?.error === 'session_expired') {
                push({ id: nextId(), role: 'qampi', kind: 'reconnect' });
                return;
            }
            const msg = err?.response?.data?.message || 'That search didn’t go through. Try again in a moment.';
            push({ id: nextId(), role: 'qampi', kind: 'text', text: msg });
        }
    }, [push]);

    // "Show 10 more" — continue the same query at the next page (dedup handled in doSearch).
    const showMore = useCallback((keywords: string, filters: SearchRecommendation['filters'] | undefined, nextPage: number) => {
        doSearch(keywords, keywords, filters, nextPage);
    }, [doSearch]);

    // Run a reasoned search draft the user approved/edited (removes the draft card).
    const runDraft = useCallback((msgId: string, label: string, keywords: string, filters?: SearchRecommendation['filters']) => {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        doSearch(label, keywords, filters, 1);
    }, [doSearch, setMessages]);

    // A vein is mined out — ask the backend for a GENUINELY different angle
    // (it grounds on the durable tried-angles memory) and show it as a draft to
    // approve, WITHOUT a fake user bubble. Used by the "Try a different angle"
    // button and auto-offered when a search returns nobody fresh.
    const rotateAngle = useCallback(async () => {
        track('copilot_rotate_angle', {});
        const thinkId = nextId();
        push({ id: thinkId, role: 'qampi', kind: 'searching', label: '…' });
        try {
            const routed = await routeMessage('Suggest a different search angle for fresh leads', historyForRouter(), importedLeadIdsRef.current.length);
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            if (routed.toolData?.searchDraft) {
                const d = routed.toolData.searchDraft;
                push({ id: nextId(), role: 'qampi', kind: 'searchDraft', label: d.label, keywords: d.keywords, filters: d.filters, rationale: d.rationale });
            } else {
                push({ id: nextId(), role: 'qampi', kind: 'text', text: routed.reply || 'Tell me a different type of person to look for and I’ll build a search.' });
            }
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'Tell me a different type of person to look for and I’ll build a search.' });
        }
    }, [push, historyForRouter]);
    rotateAngleRef.current = rotateAngle;

    // ── reply-in-chat (handle_replies) ───────────────────────────────────────
    // Draft the NEXT unanswered reply in the queue as an in-chat card. One at a
    // time (each draft is an LLM call), so the thread stays calm.
    const draftNextReply = useCallback(async () => {
        const q = repliesQueueRef.current;
        const i = replyIdxRef.current;
        if (i >= q.length) {
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'That’s every reply handled. Want to get back to prospecting?' });
            return;
        }
        const wr = q[i];
        replyIdxRef.current = i + 1;
        const cardId = nextId();
        push({ id: cardId, role: 'qampi', kind: 'replyDraft', leadId: wr.leadId, name: wr.name, subtitle: wr.subtitle, theirMessage: wr.message, draft: '', rationale: '', tone: 'professional', remaining: q.length - i - 1, state: 'drafting' });
        try {
            const d = await draftReply(wr.leadId);
            patch(cardId, { draft: d.text, rationale: d.rationale, state: 'ready' } as Partial<Msg>);
        } catch {
            patch(cardId, { state: 'error', error: 'I couldn’t draft this one — open it in the inbox.' } as Partial<Msg>);
        }
    }, [push, patch]);

    const handleReplies = useCallback((list: WaitingReply[]) => {
        repliesQueueRef.current = list || [];
        replyIdxRef.current = 0;
        if (!list || !list.length) return; // the routed reply already said "all caught up"
        draftNextReply();
    }, [draftNextReply]);

    // Queue a human-reviewed reply on the guarded send path (never auto-send).
    const sendReplyDraft = useCallback(async (msgId: string) => {
        const m = messagesRef.current.find((x) => x.id === msgId);
        if (!m || m.kind !== 'replyDraft' || !m.draft.trim()) return;
        patch(msgId, { state: 'sending' } as Partial<Msg>);
        try {
            await sendReply(m.leadId, m.draft.trim());
            track('copilot_reply_sent', {});
            patch(msgId, { state: 'sent' } as Partial<Msg>);
        } catch {
            patch(msgId, { state: 'error', error: 'Couldn’t queue that reply. Try again in a moment.' } as Partial<Msg>);
        }
    }, [patch]);

    // Regenerate the current draft in a warmer tone.
    const tryWarmerReply = useCallback(async (msgId: string) => {
        const m = messagesRef.current.find((x) => x.id === msgId);
        if (!m || m.kind !== 'replyDraft') return;
        patch(msgId, { state: 'drafting' } as Partial<Msg>);
        try {
            const d = await draftReply(m.leadId, 'warm');
            patch(msgId, { draft: d.text, rationale: d.rationale, tone: 'warm', state: 'ready' } as Partial<Msg>);
        } catch {
            patch(msgId, { state: 'error', error: 'Couldn’t re-draft that. Try again.' } as Partial<Msg>);
        }
    }, [patch]);

    const editReplyDraft = useCallback((msgId: string, text: string) => {
        patch(msgId, { draft: text } as Partial<Msg>);
    }, [patch]);

    const backToProspecting = useCallback(() => {
        if (!started) setStarted(true);
        loadSearchChips();
    }, [started, loadSearchChips]);

    const recommendCampaigns = useCallback(async () => {
        const tId = nextId();
        push({ id: tId, role: 'qampi', kind: 'templates', loading: true });
        try {
            const { picks } = await fetchTemplateRecommendations();
            patch(tId, { loading: false, picks });
        } catch {
            patch(tId, { loading: false, picks: [] });
        }
    }, [push, patch]);

    const afterImport = useCallback(async (count: number, leadIds: string[]) => {
        setImportedLeadIds((prev) => Array.from(new Set([...prev, ...leadIds])));
        push({ id: nextId(), role: 'qampi', kind: 'text', text: `Imported ${count} lead${count === 1 ? '' : 's'}. Here are campaigns that fit — pick one to launch.` });
        await recommendCampaigns();
    }, [push, recommendCampaigns, setImportedLeadIds]);

    // Launch a chosen template on the leads the confirm card was built for — via
    // the guarded endpoints (which enforce the 1-active + lead-cap rules).
    const runLaunch = useCallback(async (msgId: string, overrides?: LaunchOverrides) => {
        const msg = messagesRef.current.find((m) => m.id === msgId);
        if (!msg || msg.kind !== 'launchConfirm') return;
        const leadIds = msg.leadIds.length ? msg.leadIds : importedLeadIdsRef.current;
        patch(msgId, { state: 'launching' } as Partial<Msg>);
        const result = await launchFromTemplate(msg.templateId, leadIds, overrides);
        if (result.ok) {
            track('campaign_launched', { source: 'copilot', templateId: msg.templateId });
            patch(msgId, { state: 'done', campaignId: result.campaignId } as Partial<Msg>);
        } else {
            patch(msgId, { state: 'error', error: result.message } as Partial<Msg>);
        }
    }, [patch]);

    // Offer a one-click launch confirmation for a template. Prefers leads imported
    // in this session; if there are none (e.g. after a reload), it falls back to
    // the user's existing un-campaigned leads and ASKS before launching on them —
    // never silently bulk-fires at the whole account.
    const offerLaunch = useCallback(async (templateId: string, label: string) => {
        track('copilot_template_selected', { templateId });
        // Prefill the campaign-level setup (objective/tone/CTA) from the template
        // so the user confirms/tweaks real values, not a blank form.
        const hint = await fetchTemplateHint(templateId).catch((): TemplateHint => ({ name: label, objective: '', cta: '', tone: 'professional', durationDays: 0, stepCount: 0, needsEmail: false }));
        const setup = { objective: hint.objective, cta: hint.cta, tone: hint.tone };
        const meta = { durationDays: hint.durationDays, stepCount: hint.stepCount, needsEmail: hint.needsEmail };
        if (importedLeadIdsRef.current.length) {
            push({ id: nextId(), role: 'qampi', kind: 'launchConfirm', templateId, label, leadIds: importedLeadIdsRef.current, setup, meta, state: 'idle' });
            return;
        }
        // No session imports — look for leads already in the account.
        let available = { count: 0, leadIds: [] as string[] };
        try { available = await fetchAvailableLeads(); } catch { /* fall through to the import nudge */ }
        if (available.count > 0) {
            const note = `on your ${available.count} lead${available.count === 1 ? '' : 's'} not yet in a campaign`;
            push({ id: nextId(), role: 'qampi', kind: 'launchConfirm', templateId, label, leadIds: available.leadIds, note, setup, meta, state: 'idle' });
            return;
        }
        push({ id: nextId(), role: 'qampi', kind: 'text', text: 'Let’s find and import a few leads first — then I can launch that on them.' });
        if (!started) setStarted(true);
        loadSearchChips();
    }, [push, started, loadSearchChips]);

    // Free-text (or a quick-action chip) → intent router → the right closed
    // action (or an honest reply).
    const runMessage = useCallback(async (q: string) => {
        if (!q.trim()) return;
        if (!started) setStarted(true);
        push({ id: nextId(), role: 'user', kind: 'text', text: q });
        const thinkId = nextId();
        push({ id: thinkId, role: 'qampi', kind: 'searching', label: '…' });
        try {
            const routed = await routeMessage(q, historyForRouter(), importedLeadIdsRef.current.length);
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            if (routed.reply) push({ id: nextId(), role: 'qampi', kind: 'text', text: routed.reply });
            if (routed.intent === 'find_leads') {
                // Show the reasoned query first (approve/edit before spending a search);
                // fall back to a raw-phrase search if the builder didn't return one.
                if (routed.toolData?.searchDraft) {
                    const d = routed.toolData.searchDraft;
                    push({ id: nextId(), role: 'qampi', kind: 'searchDraft', label: d.label, keywords: d.keywords, filters: d.filters, rationale: d.rationale });
                } else {
                    const kw = routed.params.keywords || q;
                    doSearch(kw, kw);
                }
            } else if (routed.intent === 'recommend_campaign') {
                recommendCampaigns();
            } else if (routed.intent === 'launch_campaign') {
                if (routed.params.templateId) offerLaunch(routed.params.templateId, routed.params.templateId);
                else recommendCampaigns();
            } else if (routed.intent === 'handle_replies') {
                handleReplies(routed.toolData?.waitingReplies || []);
            }
            // lookup_lead / check_status / explain / unsupported / off_topic → the reply already said it.
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'I had trouble with that — try rephrasing, or tell me the kind of people you want to reach.' });
        }
    }, [started, push, doSearch, recommendCampaigns, offerLaunch, handleReplies, historyForRouter]);

    const submitInput = useCallback(() => {
        const q = input.trim();
        if (!q) return;
        setInput('');
        runMessage(q);
    }, [input, runMessage]);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line shrink-0">
                <img src="/qampi_wbg.png" alt="Qampi" className="w-7 h-7 rounded-chip object-contain shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">Qampi</p>
                    <p className="text-[11px] text-ink-500 leading-tight">{variant === 'fullscreen' ? 'Setting up your first campaign' : 'Your outreach copilot'}</p>
                </div>
                {variant === 'panel' && (
                    <ThreadControls
                        threads={threads}
                        activeThreadId={activeThreadId}
                        open={threadMenuOpen}
                        setOpen={setThreadMenuOpen}
                        onSwitch={(id) => { switchThread(id); setThreadMenuOpen(false); }}
                        onNew={() => { newThread(); setThreadMenuOpen(false); }}
                        onDelete={deleteThread}
                    />
                )}
                {onClose && (
                    <button onClick={onClose} className="ml-auto text-[12px] text-ink-500 hover:text-ink-900 font-medium">
                        Skip for now
                    </button>
                )}
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                {variant === 'panel' && hydrated && messages.length === 0 && (
                    <PanelResting
                        onSuggestSearches={() => { setStarted(true); track('copilot_opened', { variant: 'panel' }); loadSearchChips(); }}
                        onRecommendCampaign={() => { setStarted(true); recommendCampaigns(); }}
                        onCheckStatus={() => runMessage('How is my campaign doing?')}
                    />
                )}

                {messages.map((m) => (
                    <MessageRow
                        key={m.id}
                        m={m}
                        onPickSearch={doSearch}
                        onRunDraft={runDraft}
                        onShowMore={showMore}
                        onTryDifferent={rotateAngle}
                        onImported={afterImport}
                        onPickTemplate={offerLaunch}
                        onLaunch={runLaunch}
                        onSendReply={sendReplyDraft}
                        onTryWarmer={tryWarmerReply}
                        onEditReply={editReplyDraft}
                        onDraftNext={draftNextReply}
                        onBackToProspecting={backToProspecting}
                    />
                ))}
            </div>

            {/* composer */}
            <div className="shrink-0 px-3 pt-2 pb-3 border-t border-line">
                {/* Persistent quick prompts — always reachable, not just on an empty thread. */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {QUICK_PROMPTS.map((qp) => (
                        <button
                            key={qp.label}
                            onClick={() => {
                                if (qp.action === 'search') { setStarted(true); track('copilot_quickprompt', { action: 'search' }); loadSearchChips(); }
                                else if (qp.action === 'campaign') { setStarted(true); track('copilot_quickprompt', { action: 'campaign' }); recommendCampaigns(); }
                                else { track('copilot_quickprompt', { action: 'status' }); runMessage(qp.send); }
                            }}
                            className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-medium bg-surface border border-line rounded-chip px-2.5 py-1.5 text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand transition-colors whitespace-nowrap"
                        >
                            <qp.icon className="w-3 h-3 text-brand" /> {qp.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-end gap-2 bg-card border border-line rounded-card px-3 py-2 focus-within:border-brand-200 transition-colors">
                    <textarea
                        ref={taRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInput(); } }}
                        placeholder="Type a search, or ask Qampi…"
                        className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-ink-400 outline-none leading-relaxed max-h-[120px] overflow-y-auto"
                    />
                    <button
                        onClick={submitInput}
                        disabled={!input.trim()}
                        aria-label="Send"
                        className="w-8 h-8 rounded-chip bg-brand text-white grid place-items-center shrink-0 disabled:opacity-40 hover:bg-brand-600 transition-colors"
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Relative age of a thread (from an epoch-ms timestamp) for the recent-threads list.
function relThread(ts: number, now: number): string {
    const d = now - ts;
    if (d < 60_000) return 'now';
    const m = Math.floor(d / 60_000); if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24); if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
}

// Chatbox header controls: a clock (recent threads) + a new-chat button. The
// clock opens a right-aligned dropdown to switch/delete; new-chat starts fresh.
function ThreadControls({ threads, activeThreadId, open, setOpen, onSwitch, onNew, onDelete }: {
    threads: ThreadMeta[];
    activeThreadId: string;
    open: boolean;
    setOpen: (b: boolean) => void;
    onSwitch: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [now] = useState(() => Date.now());
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open, setOpen]);
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    const iconBtn = 'w-8 h-8 rounded-control grid place-items-center text-ink-500 hover:text-brand hover:bg-brand-50 transition-colors';
    return (
        <div className="ml-auto relative" ref={ref}>
            <div className="flex items-center gap-1">
                <button onClick={() => setOpen(!open)} title="Recent threads" aria-label="Recent threads" className={iconBtn}><Clock className="w-4 h-4" /></button>
                <button onClick={onNew} title="New chat" aria-label="New chat" className={iconBtn}><PenSquare className="w-4 h-4" /></button>
            </div>
            {open && (
                <div className="absolute right-0 top-9 w-60 bg-card border border-line rounded-card shadow-lift p-1.5 z-30">
                    <p className="label !text-[10px] px-2 py-1.5">Recent threads</p>
                    <div className="max-h-64 overflow-y-auto">
                        {sorted.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => onSwitch(t.id)}
                                className={cn('group flex items-center gap-2 px-2 py-1.5 rounded-control cursor-pointer', t.id === activeThreadId ? 'bg-brand-50' : 'hover:bg-surface')}
                            >
                                <span className={cn('flex-1 min-w-0 truncate text-[13px]', t.id === activeThreadId ? 'text-brand-600 font-medium' : 'text-foreground')}>{t.title}</span>
                                <span className="text-[10px] text-ink-400 shrink-0">{relThread(t.updatedAt, now)}</span>
                                {sorted.length > 1 && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} title="Delete thread" aria-label="Delete thread" className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button onClick={onNew} className="mt-1 w-full flex items-center gap-2 px-2 py-2 rounded-control text-[13px] font-medium text-brand-600 border-t border-line hover:bg-brand-50 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> New thread
                    </button>
                </div>
            )}
        </div>
    );
}

// A proactive opening grounded in real state: what's running + what needs the
// user, so a fresh thread never opens with a hollow "how can I help?".
function buildGreeting(ctx: ProactiveContext | null): string {
    if (!ctx) return 'Hi — I can find leads, suggest a campaign, or check how things are going. Where do you want to start?';
    const name = ctx.firstName ? ` ${ctx.firstName}` : '';
    const lead = ctx.campaign
        ? `your ${ctx.campaign.name} campaign is running (${ctx.campaign.processed}/${ctx.campaign.total} leads)`
        : 'no campaign is running right now';
    let s = `Hi${name} — ${lead}.`;
    if (ctx.repliesWaiting > 0) s += ` You’ve got ${ctx.repliesWaiting} ${ctx.repliesWaiting === 1 ? 'reply' : 'replies'} waiting.`;
    s += ' Where do you want to start?';
    return s;
}

function PanelResting({ onSuggestSearches, onRecommendCampaign, onCheckStatus }: {
    onSuggestSearches: () => void;
    onRecommendCampaign: () => void;
    onCheckStatus: () => void;
}) {
    const [ctx, setCtx] = useState<ProactiveContext | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetchProactiveContext().then((d) => { if (!cancelled) setCtx(d); }).catch(() => { /* plain greeting */ });
        return () => { cancelled = true; };
    }, []);
    const chips: { icon: typeof Search; label: string; onClick: () => void }[] = [
        { icon: Search, label: 'Suggest some searches', onClick: onSuggestSearches },
        { icon: Rocket, label: 'What campaign should I run?', onClick: onRecommendCampaign },
        { icon: ArrowRight, label: 'How’s my campaign doing?', onClick: onCheckStatus },
    ];
    return (
        <div className="space-y-3">
            <QBubble>
                <p>{buildGreeting(ctx)}</p>
            </QBubble>
            <div className="pl-8 flex flex-col gap-2 items-start">
                {chips.map((c) => (
                    <button
                        key={c.label}
                        onClick={c.onClick}
                        className="inline-flex items-center gap-2 text-[13px] font-medium bg-card border border-line rounded-chip px-3 py-2 hover:border-brand-200 hover:bg-brand-50 transition-colors"
                    >
                        <c.icon className="w-3.5 h-3.5 text-brand" /> {c.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MessageRow({ m, onPickSearch, onRunDraft, onShowMore, onTryDifferent, onImported, onPickTemplate, onLaunch, onSendReply, onTryWarmer, onEditReply, onDraftNext, onBackToProspecting }: {
    m: Msg;
    onPickSearch: (label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onRunDraft: (msgId: string, label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onShowMore: (keywords: string, filters: SearchRecommendation['filters'] | undefined, nextPage: number) => void;
    onTryDifferent: () => void;
    onImported: (count: number, leadIds: string[]) => void;
    onPickTemplate: (templateId: string, label: string) => void;
    onLaunch: (msgId: string, overrides?: LaunchOverrides) => void;
    onSendReply: (msgId: string) => void;
    onTryWarmer: (msgId: string) => void;
    onEditReply: (msgId: string, text: string) => void;
    onDraftNext: () => void;
    onBackToProspecting: () => void;
}) {
    if (m.kind === 'text') {
        return m.role === 'user'
            ? <div className="flex justify-end"><div className="max-w-[80%] bg-brand text-white text-[13px] px-3.5 py-2 rounded-card rounded-tr-chip">{m.text}</div></div>
            : <QBubble>{m.text}</QBubble>;
    }
    if (m.kind === 'understand') return <QBubble><UnderstandCard loading={m.loading} data={m.data} /></QBubble>;
    if (m.kind === 'searchChips') return <div className="pl-8"><SearchChips loading={m.loading} recs={m.recs} onPick={onPickSearch} /></div>;
    if (m.kind === 'searchDraft') return <div className="pl-8"><SearchDraftCard m={m} onRun={onRunDraft} /></div>;
    if (m.kind === 'searching') return <QBubble><span className="inline-flex items-center gap-2 text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> {m.label === '…' ? 'Thinking…' : `Searching LinkedIn for “${m.label}”…`}</span></QBubble>;
    if (m.kind === 'results') return <div className="pl-8"><ResultsBlock m={m} onImported={onImported} onShowMore={onShowMore} onTryDifferent={onTryDifferent} /></div>;
    if (m.kind === 'templates') return <div className="pl-8"><TemplatePicks loading={m.loading} picks={m.picks} onPick={onPickTemplate} /></div>;
    if (m.kind === 'launchConfirm') return <div className="pl-8"><LaunchConfirm m={m} onLaunch={onLaunch} /></div>;
    if (m.kind === 'replyDraft') return <div className="pl-8"><ReplyDraftCard m={m} onSend={onSendReply} onTryWarmer={onTryWarmer} onEdit={onEditReply} onDraftNext={onDraftNext} onBackToProspecting={onBackToProspecting} /></div>;
    if (m.kind === 'reconnect') return <QBubble><ReconnectNotice /></QBubble>;
    return null;
}

// A reasoned query, shown BEFORE a search is spent. The user edits the boolean +
// filters, sees why it fits, then runs it (searches are budget-scarce).
function SearchDraftCard({ m, onRun }: { m: Extract<Msg, { kind: 'searchDraft' }>; onRun: (msgId: string, label: string, keywords: string, filters?: SearchRecommendation['filters']) => void }) {
    const [keywords, setKeywords] = useState(m.keywords);
    const fieldCls = 'w-full bg-card border border-line rounded-control px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-200 transition-colors font-mono';
    const facets = [m.filters?.title, m.filters?.industry, m.filters?.location, m.filters?.degree && m.filters.degree !== 'any' ? `${m.filters.degree}°` : '']
        .filter(Boolean).join(' · ');
    return (
        <div className="bg-card border border-line rounded-card p-3 space-y-2">
            <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-[13px] font-medium text-foreground">{m.label}</span>
            </div>
            {m.rationale && <p className="text-[11px] text-ink-500">{m.rationale}</p>}
            <div>
                <label className="label !text-[10px] mb-1 block">Search query (editable)</label>
                <textarea rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} className={cn(fieldCls, 'resize-none leading-snug')} />
            </div>
            {facets && <p className="text-[10px] text-ink-400">Filters: {facets}</p>}
            <button
                onClick={() => onRun(m.id, m.label, keywords.trim() || m.keywords, m.filters)}
                className="inline-flex items-center gap-2 text-[13px] font-medium bg-brand text-white rounded-chip px-3.5 py-2 hover:bg-brand-600 transition-colors"
            >
                <Search className="w-3.5 h-3.5" /> Run this search
            </button>
        </div>
    );
}

const TONE_OPTIONS = ['direct', 'friendly', 'professional', 'warm', 'consultative'];
// Mirrors the server's DAILY_CAPS.connect — used only for a pacing ESTIMATE in
// the launch card ("rolls out over ~N days"), so approximate is fine.
const DAILY_INVITE_CAP = 18;

function LaunchConfirm({ m, onLaunch }: { m: Extract<Msg, { kind: 'launchConfirm' }>; onLaunch: (msgId: string, overrides?: LaunchOverrides) => void }) {
    // Campaign-level setup, prefilled from the template and editable here. Local
    // state (launchConfirm only persists once done), passed as overrides on launch.
    const [objective, setObjective] = useState(m.setup?.objective || '');
    const [cta, setCta] = useState(m.setup?.cta || '');
    const [tone, setTone] = useState(m.setup?.tone || 'professional');

    if (m.state === 'done') {
        return (
            <div className="bg-card border border-line rounded-card px-3.5 py-3 text-[13px]">
                <p className="inline-flex items-center gap-1.5 text-emerald-600 font-medium"><Check className="w-4 h-4" /> Campaign launched</p>
                <Link href={`/campaigns/${m.campaignId}`} className="block mt-1 text-[12px] text-brand hover:underline">View your campaign →</Link>
            </div>
        );
    }
    if (m.state === 'error') {
        return (
            <div className="bg-card border border-line rounded-card px-3.5 py-3 text-[13px] text-ink-700">
                {m.error}
                <Link href="/campaigns" className="block mt-1 text-[12px] text-brand hover:underline">Manage campaigns →</Link>
            </div>
        );
    }

    const launching = m.state === 'launching';
    const fieldCls = 'w-full bg-card border border-line rounded-control px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-200 transition-colors disabled:opacity-60';

    return (
        <div className="bg-card border border-line rounded-card p-3 space-y-2.5">
            <p className="text-[12px] text-ink-500">
                Set up <span className="text-foreground font-medium">“{m.label}”</span>{m.note ? ` — ${m.note}` : ''}. Tweak anything, then launch.
            </p>
            {m.meta && (m.meta.durationDays > 0 || m.meta.needsEmail) && (
                <p className="text-[11px] text-ink-500">
                    {m.meta.durationDays > 0 ? `Runs ~${m.meta.durationDays} days` : ''}{m.meta.stepCount > 0 ? ` · ${m.meta.stepCount} steps` : ''}{m.meta.needsEmail ? ' · needs verified emails (email finder)' : ''}
                </p>
            )}
            {m.leadIds.length > 0 && (
                <p className="text-[11px] text-ink-500">
                    LinkedIn caps invites at ~{DAILY_INVITE_CAP}/day, so your {m.leadIds.length} lead{m.leadIds.length === 1 ? '' : 's'} roll out over ~{Math.max(1, Math.ceil(m.leadIds.length / DAILY_INVITE_CAP))} day{Math.max(1, Math.ceil(m.leadIds.length / DAILY_INVITE_CAP)) === 1 ? '' : 's'} — I can’t send them all at once.
                </p>
            )}
            <div className="space-y-2">
                <div>
                    <label className="label !text-[10px] mb-1 block">Objective</label>
                    <textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} disabled={launching}
                        className={cn(fieldCls, 'resize-none leading-snug')} placeholder="What should this campaign achieve?" />
                </div>
                <div className="flex gap-2">
                    <div className="w-[38%]">
                        <label className="label !text-[10px] mb-1 block">Tone</label>
                        <select value={tone} onChange={(e) => setTone(e.target.value)} disabled={launching} className={cn(fieldCls, 'capitalize')}>
                            {TONE_OPTIONS.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="label !text-[10px] mb-1 block">Call to action</label>
                        <input value={cta} onChange={(e) => setCta(e.target.value)} disabled={launching}
                            className={fieldCls} placeholder="e.g. book a 20-min call" />
                    </div>
                </div>
            </div>
            <button
                onClick={() => m.state === 'idle' && onLaunch(m.id, { objective: objective.trim(), cta: cta.trim(), toneOverride: tone })}
                disabled={launching}
                className="inline-flex items-center gap-2 text-[13px] font-medium bg-brand text-white rounded-chip px-3.5 py-2 disabled:opacity-60 hover:bg-brand-600 transition-colors"
            >
                {launching
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching…</>
                    : <><Rocket className="w-3.5 h-3.5" /> Launch campaign</>}
            </button>
        </div>
    );
}

// An in-chat reply card: the lead's message + a Qampi draft. The user reviews
// (edit / warm it up), then Send queues it on the human-controlled send path —
// Qampi never sends on its own. After sending, offer the next waiting reply.
function ReplyDraftCard({ m, onSend, onTryWarmer, onEdit, onDraftNext, onBackToProspecting }: {
    m: Extract<Msg, { kind: 'replyDraft' }>;
    onSend: (id: string) => void;
    onTryWarmer: (id: string) => void;
    onEdit: (id: string, text: string) => void;
    onDraftNext: () => void;
    onBackToProspecting: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const initials = m.name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('');
    const drafting = m.state === 'drafting';
    const sending = m.state === 'sending';
    const sent = m.state === 'sent';

    return (
        <div className="bg-card border border-line rounded-card p-3 space-y-2.5 max-w-[92%]">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-50 text-brand grid place-items-center text-[11px] font-medium shrink-0">{initials || '?'}</div>
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{m.name}</p>
                    {m.subtitle && <p className="text-[11px] text-ink-500 truncate">{m.subtitle}</p>}
                </div>
            </div>
            <p className="text-[12.5px] text-ink-700 italic border-l-2 border-line pl-3">“{m.theirMessage}”</p>

            {drafting ? (
                <div className="inline-flex items-center gap-2 text-ink-500 text-[13px]"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Drafting a reply…</div>
            ) : m.state === 'error' ? (
                <div className="text-[13px] text-ink-700">{m.error}<Link href="/inbox" className="block mt-1 text-[12px] text-brand hover:underline">Open inbox →</Link></div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                        <span className="label !text-[10px] !text-brand-600">Draft reply</span>
                        {m.tone === 'warm' && <span className="text-[10px] text-ink-400">· warmer</span>}
                    </div>
                    {m.rationale && <p className="text-[11px] text-ink-500">{m.rationale}</p>}
                    {editing && !sent ? (
                        <textarea rows={4} value={m.draft} onChange={(e) => onEdit(m.id, e.target.value)} className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-brand-200 resize-none leading-relaxed" />
                    ) : (
                        <div className="text-[13px] leading-relaxed text-foreground bg-surface rounded-control px-3 py-2.5 whitespace-pre-wrap">{m.draft}</div>
                    )}

                    {sent ? (
                        <div className="space-y-2">
                            <p className="inline-flex items-center gap-1.5 text-emerald-600 text-[13px] font-medium"><Check className="w-4 h-4" /> Reply queued to send</p>
                            <div className="flex gap-2 flex-wrap">
                                {m.remaining > 0
                                    ? <button onClick={onDraftNext} className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-brand text-white rounded-chip px-3.5 py-2 hover:bg-brand-600 transition-colors"><MessageSquare className="w-3.5 h-3.5" /> Draft the next ({m.remaining} left)</button>
                                    : <span className="text-[12px] text-ink-500">That’s the last one.</span>}
                                <button onClick={onBackToProspecting} className="text-[13px] font-medium text-ink-700 bg-card border border-line rounded-chip px-3 py-2 hover:border-brand-200 transition-colors">Back to prospecting</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => onSend(m.id)} disabled={sending || !m.draft.trim()} className="inline-flex items-center gap-2 text-[13px] font-medium bg-brand text-white rounded-chip px-3.5 py-2 disabled:opacity-60 hover:bg-brand-600 transition-colors">
                                {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send reply</>}
                            </button>
                            <button onClick={() => setEditing((e) => !e)} disabled={sending} className="text-[13px] font-medium text-ink-700 bg-card border border-line rounded-chip px-3 py-2 hover:border-brand-200 transition-colors">{editing ? 'Done' : 'Edit'}</button>
                            <button onClick={() => onTryWarmer(m.id)} disabled={sending} className="text-[13px] font-medium text-ink-700 bg-card border border-line rounded-chip px-3 py-2 hover:border-brand-200 transition-colors">Try warmer</button>
                            {m.remaining > 0 && <span className="ml-auto text-[11px] text-ink-400">{m.remaining} more waiting</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ReconnectNotice() {
    return (
        <div>
            <p className="mb-2">Your LinkedIn session has expired, so I can’t search right now. Reconnect and I’ll pick up where we left off.</p>
            <Link href="/settings?tab=linkedin" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline">
                <LinkIcon className="w-3.5 h-3.5" /> Reconnect LinkedIn
            </Link>
        </div>
    );
}

function QBubble({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2.5">
            <img src="/qampi_wbg.png" alt="Qampi" className="w-6 h-6 rounded-chip object-contain shrink-0 mt-0.5" />
            <div className="bg-card border border-line rounded-card rounded-tl-chip px-3.5 py-2.5 text-[13px] text-foreground leading-relaxed max-w-[85%]">
                {children}
            </div>
        </div>
    );
}

function UnderstandCard({ loading, data }: { loading: boolean; data?: Understand }) {
    if (loading) return <span className="inline-flex items-center gap-2 text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Reading your profile…</span>;
    if (!data) return <span>I couldn’t build your summary — you can still search below.</span>;
    return (
        <div>
            <p className="mb-2">Here’s how I understand you:</p>
            <div className="bg-surface rounded-chip p-2.5 space-y-1.5">
                {data.youAre && <Row label="You are" value={data.youAre} />}
                {data.yourGoal && <Row label="Your goal" value={data.yourGoal} />}
                {data.bestFitBuyer && <Row label="Best-fit buyer" value={data.bestFitBuyer} />}
            </div>
            <Link href="/settings/ai-profile" className="inline-block mt-2 text-[12px] text-brand hover:underline">Not quite right? Edit this</Link>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-[12px] leading-snug">
            <span className="text-ink-500">{label}: </span>
            <span className="text-foreground">{value}</span>
        </div>
    );
}

function SearchChips({ loading, recs, onPick }: { loading: boolean; recs?: SearchRecommendation[]; onPick: (label: string, keywords: string, filters?: SearchRecommendation['filters']) => void }) {
    if (loading) return <span className="inline-flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Thinking of good searches…</span>;
    if (!recs || !recs.length) return <span className="text-[13px] text-ink-500">No suggestions — type a search below.</span>;
    return (
        <div className="flex flex-col gap-2">
            {recs.map((r, i) => (
                <button
                    key={i}
                    onClick={() => onPick(r.label, r.keywords, r.filters)}
                    className="text-left bg-card border border-line rounded-card px-3 py-2.5 hover:border-brand-200 hover:bg-brand-50 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="text-[13px] font-medium text-foreground">{r.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-ink-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {r.rationale && <p className="text-[11px] text-ink-500 mt-1 pl-6">{r.rationale}</p>}
                </button>
            ))}
        </div>
    );
}

function ResultsBlock({ m, onImported, onShowMore, onTryDifferent }: {
    m: Extract<Msg, { kind: 'results' }>;
    onImported: (count: number, leadIds: string[]) => void;
    onShowMore: (keywords: string, filters: SearchRecommendation['filters'] | undefined, nextPage: number) => void;
    onTryDifferent: () => void;
}) {
    const people = m.people;
    const [selected, setSelected] = useState<Set<number>>(() => new Set(people.map((_, i) => i)));
    const [importing, setImporting] = useState(false);
    const [done, setDone] = useState<number | null>(null);

    const toggle = (i: number) => setSelected((prev) => {
        const n = new Set(prev);
        if (n.has(i)) n.delete(i); else n.add(i);
        return n;
    });

    const doImport = async () => {
        const chosen = people.filter((_, i) => selected.has(i));
        if (!chosen.length) return;
        setImporting(true);
        try {
            const { importedTotal, leadIds } = await importPeople(chosen);
            const n = importedTotal || chosen.length;
            track('leads_imported', { count: n, source: 'copilot' });
            setDone(n);
            onImported(n, leadIds);
        } catch {
            setImporting(false);
        }
    };

    return (
        <div className="bg-card border border-line rounded-card p-2.5 space-y-1.5">
            {people.map((p, i) => (
                <button
                    key={p.linkedinUrl}
                    onClick={() => !done && toggle(i)}
                    disabled={!!done}
                    className={cn('w-full flex items-center gap-2.5 px-2 py-1.5 rounded-chip text-left transition-colors', selected.has(i) ? 'bg-brand-50' : 'hover:bg-surface')}
                >
                    <div className="w-7 h-7 rounded-full bg-brand-50 text-brand grid place-items-center text-[11px] font-medium shrink-0">
                        {(p.firstName?.[0] || '') + (p.lastName?.[0] || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">
                            {p.name}
                            {p.connectionDegree && <span className="text-[10px] text-ink-400 font-normal"> · {p.connectionDegree === 1 ? '1st' : p.connectionDegree === 2 ? '2nd' : '3rd'}</span>}
                        </p>
                        <p className="text-[11px] text-ink-500 truncate">{p.headline || p.jobTitle}</p>
                    </div>
                    {selected.has(i)
                        ? <Check className="w-4 h-4 text-brand shrink-0" />
                        : <Plus className="w-4 h-4 text-ink-400 shrink-0" />}
                </button>
            ))}
            {done == null ? (
                <button
                    onClick={doImport}
                    disabled={importing || selected.size === 0}
                    className="w-full mt-1 bg-brand text-white text-[13px] font-medium rounded-chip py-2 grid place-items-center disabled:opacity-40 hover:bg-brand-600 transition-colors"
                >
                    {importing
                        ? <span className="inline-flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</span>
                        : `Import ${selected.size} selected`}
                </button>
            ) : (
                <p className="text-center text-[12px] text-emerald-600 font-medium py-1.5 inline-flex items-center justify-center gap-1.5 w-full"><Check className="w-3.5 h-3.5" /> {done} imported</p>
            )}
            {/* Next step depends on the durable saturation signal:
                • exhausted  → this vein is mined out; offer a fresh angle instead.
                • budget out → no monthly searches left; point to the extension.
                • otherwise  → keep paging the SAME query (dedup handled server-side),
                  and if it's drying up, also offer a pivot.  */}
            {m.saturation?.state === 'exhausted' ? (
                <button
                    onClick={onTryDifferent}
                    className="w-full mt-0.5 text-[12px] font-medium text-brand rounded-chip py-1.5 hover:bg-brand-50 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                    <Sparkles className="w-3.5 h-3.5" /> This angle’s mined out — try a different one
                </button>
            ) : m.remaining <= 0 ? (
                <p className="text-center text-[11px] text-ink-400 py-1.5">No searches left this month — use the Qampi extension to import more.</p>
            ) : (
                <>
                    <button
                        onClick={() => onShowMore(m.keywords, m.filters, m.page + 1)}
                        className="w-full mt-0.5 text-[12px] font-medium text-brand rounded-chip py-1.5 hover:bg-brand-50 transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" /> Show 10 more <span className="text-ink-400 font-normal">· {m.remaining} searches left</span>
                    </button>
                    {m.saturation?.state === 'saturating' && (
                        <button
                            onClick={onTryDifferent}
                            className="w-full text-[11px] font-medium text-ink-500 rounded-chip py-1 hover:text-brand transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                            <Sparkles className="w-3 h-3" /> running low on fresh matches — try a different angle
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

function TemplatePicks({ loading, picks, onPick }: { loading: boolean; picks?: TemplatePick[]; onPick: (id: string, label: string) => void }) {
    if (loading) return <span className="inline-flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Matching campaigns to your goal…</span>;
    if (!picks || !picks.length) return <Link href="/campaigns" className="text-[13px] text-brand hover:underline">Browse campaign templates →</Link>;
    return (
        <div className="flex flex-col gap-2">
            {picks.map((t) => (
                <button
                    key={t.templateId}
                    onClick={() => onPick(t.templateId, t.label)}
                    className="text-left bg-card border border-line rounded-card px-3 py-2.5 hover:border-brand-200 hover:bg-brand-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{t.icon}</span>
                        <span className="text-[13px] font-medium text-foreground">{t.label}</span>
                    </div>
                    {t.why && <p className="text-[11px] text-ink-500 mt-1 line-clamp-2">{t.why}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-ink-400">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {t.durationDays}d</span>
                        <span>{t.stepCount} steps</span>
                        {t.needsEmail && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> needs email finder</span>}
                    </div>
                </button>
            ))}
            <Link href="/campaigns" className="text-[12px] text-ink-500 hover:text-brand hover:underline mt-0.5">Browse all templates →</Link>
        </div>
    );
}
