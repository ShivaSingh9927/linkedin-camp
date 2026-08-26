'use client';

// The activation copilot conversation engine — shared by the full-screen first-run
// takeover and the permanent dashboard panel. Layout-agnostic: it fills its
// container and drives the flow understand → recommend search → run search →
// results + import → recommend templates. `variant` only changes the opening
// behavior: 'fullscreen' auto-starts (understand card + search chips); 'panel'
// stays quiet until the user asks.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, ArrowUp, Check, Plus, MapPin, Clock, ArrowRight, Rocket, LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
    fetchUnderstand, fetchSearchRecommendations, runSearch, importPeople, fetchTemplateRecommendations,
    routeMessage, launchFromTemplate, fetchAvailableLeads, fetchTemplateHint,
    type Understand, type SearchRecommendation, type SearchPerson, type TemplatePick, type HistoryMsg, type LaunchOverrides, type TemplateHint,
} from './copilotApi';
import { type Msg, nextId } from './copilotTypes';
import { useCopilot } from './CopilotProvider';

// Ready-to-use prompts pinned above the composer, always reachable (not just on
// an empty thread). `send` is the text run through the router for free-text
// intents; 'search'/'campaign' short-circuit to the deterministic flows.
const QUICK_PROMPTS: { label: string; icon: typeof Search; action: 'search' | 'campaign' | 'status'; send: string }[] = [
    { label: 'Suggest searches', icon: Search, action: 'search', send: '' },
    { label: 'What campaign should I run?', icon: Rocket, action: 'campaign', send: '' },
    { label: 'How’s my campaign?', icon: ArrowRight, action: 'status', send: 'How is my campaign doing?' },
    { label: 'Suggest boolean keywords', icon: Search, action: 'status', send: 'Suggest some boolean search keywords for my best-fit leads.' },
];

export function CopilotConversation({ variant, onClose }: { variant: 'fullscreen' | 'panel'; onClose?: () => void }) {
    // Conversation state is owned by the layout-level provider so it survives
    // route navigation and (via localStorage) reloads. This component is a view.
    const { messages, setMessages, importedLeadIds, setImportedLeadIds, hydrated } = useCopilot();
    const [input, setInput] = useState('');
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
    // LinkedIn URLs already shown this session — so "Show 10 more" and repeat
    // searches never re-surface the same people. Session-only for now; the
    // durable cross-session coverage engine comes later.
    const seenUrlsRef = useRef<Set<string>>(new Set());

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
            const res = await runSearch(keywords, filters, page);
            track('copilot_search_run', { via: res.via, count: res.people.length, page });
            setMessages((prev) => prev.filter((m) => m.id !== sId));
            // Drop anyone already shown this session so pages never repeat.
            const fresh = res.people.filter((p) => p.linkedinUrl && !seenUrlsRef.current.has(p.linkedinUrl));
            fresh.forEach((p) => p.linkedinUrl && seenUrlsRef.current.add(p.linkedinUrl));
            if (!fresh.length) {
                push({
                    id: nextId(), role: 'qampi', kind: 'text',
                    text: page > 1
                        ? 'That’s everyone I can find for this search. Try a different angle, or use the Qampi extension to import a bigger batch.'
                        : 'I couldn’t pull results for that one. Try another search or rephrase it.',
                });
                return;
            }
            push({ id: nextId(), role: 'qampi', kind: 'text', text: page > 1 ? `Found ${fresh.length} more.` : `Found ${fresh.length} people. Pick the ones you want and I’ll import them.` });
            push({ id: nextId(), role: 'qampi', kind: 'results', people: fresh, via: res.via, remaining: res.remaining, cap: res.cap, keywords, filters, page });
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
            }
            // lookup_lead / check_status / explain / unsupported / off_topic → the reply already said it.
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'I had trouble with that — try rephrasing, or tell me the kind of people you want to reach.' });
        }
    }, [started, push, doSearch, recommendCampaigns, offerLaunch, historyForRouter]);

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
                        onImported={afterImport}
                        onPickTemplate={offerLaunch}
                        onLaunch={runLaunch}
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

function PanelResting({ onSuggestSearches, onRecommendCampaign, onCheckStatus }: {
    onSuggestSearches: () => void;
    onRecommendCampaign: () => void;
    onCheckStatus: () => void;
}) {
    const chips: { icon: typeof Search; label: string; onClick: () => void }[] = [
        { icon: Search, label: 'Suggest some searches', onClick: onSuggestSearches },
        { icon: Rocket, label: 'What campaign should I run?', onClick: onRecommendCampaign },
        { icon: ArrowRight, label: 'How’s my campaign doing?', onClick: onCheckStatus },
    ];
    return (
        <div className="space-y-3">
            <QBubble>
                <p>Hi — I can find leads, suggest a campaign, or check how things are going. Where do you want to start?</p>
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

function MessageRow({ m, onPickSearch, onRunDraft, onShowMore, onImported, onPickTemplate, onLaunch }: {
    m: Msg;
    onPickSearch: (label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onRunDraft: (msgId: string, label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onShowMore: (keywords: string, filters: SearchRecommendation['filters'] | undefined, nextPage: number) => void;
    onImported: (count: number, leadIds: string[]) => void;
    onPickTemplate: (templateId: string, label: string) => void;
    onLaunch: (msgId: string, overrides?: LaunchOverrides) => void;
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
    if (m.kind === 'results') return <div className="pl-8"><ResultsBlock m={m} onImported={onImported} onShowMore={onShowMore} /></div>;
    if (m.kind === 'templates') return <div className="pl-8"><TemplatePicks loading={m.loading} picks={m.picks} onPick={onPickTemplate} /></div>;
    if (m.kind === 'launchConfirm') return <div className="pl-8"><LaunchConfirm m={m} onLaunch={onLaunch} /></div>;
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

function ResultsBlock({ m, onImported, onShowMore }: {
    m: Extract<Msg, { kind: 'results' }>;
    onImported: (count: number, leadIds: string[]) => void;
    onShowMore: (keywords: string, filters: SearchRecommendation['filters'] | undefined, nextPage: number) => void;
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
            {/* Continue the SAME query at the next page — dedup handled upstream.
                Shows remaining monthly budget so the cost of another page is clear. */}
            {m.remaining > 0 && (
                <button
                    onClick={() => onShowMore(m.keywords, m.filters, m.page + 1)}
                    className="w-full mt-0.5 text-[12px] font-medium text-brand rounded-chip py-1.5 hover:bg-brand-50 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                    <Plus className="w-3.5 h-3.5" /> Show 10 more <span className="text-ink-400 font-normal">· {m.remaining} searches left</span>
                </button>
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
