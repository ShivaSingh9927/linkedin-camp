'use client';

// The activation copilot conversation engine — shared by the full-screen first-run
// takeover and the permanent dashboard panel. Layout-agnostic: it fills its
// container and drives the flow understand → recommend search → run search →
// results + import → recommend templates. `variant` only changes the opening
// behavior: 'fullscreen' auto-starts (understand card + search chips); 'panel'
// stays quiet until the user asks.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, ArrowUp, Check, Plus, MapPin, Clock, ArrowRight, Rocket, LinkIcon, Sparkles, PenSquare, Trash2, MessageSquare, Send, ExternalLink, FileText, ShieldCheck, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypingLoader } from '@/components/ui/loader';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ui/reasoning';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { track } from '@/lib/analytics';
import { updateCopilotHarnessTurn } from '@/lib/copilot-harness-store';
import {
    fetchUnderstand, fetchSearchRecommendations, runSearch, fetchTemplateRecommendations,
    routeMessage, launchFromTemplate, fetchAvailableLeads, fetchTemplateHint, fetchProactiveContext,
    draftReply, sendReply, searchAndSummarizeWeb,
    type Understand, type SearchRecommendation, type TemplatePick, type HistoryMsg, type LaunchOverrides, type TemplateHint, type ProactiveContext, type WaitingReply,
} from './copilotApi';
import { type Msg, nextId } from './copilotTypes';
import { useCopilot, type ThreadMeta } from './CopilotProvider';

// Ready-to-use prompts pinned above the composer, always reachable (not just on
// an empty thread). `send` is the text run through the router for free-text
// intents; 'search'/'campaign' short-circuit to the deterministic flows.
const QUICK_PROMPTS: { label: string; icon: typeof Search; action: 'search' | 'campaign' | 'status'; send: string; intent?: 'check_status' | 'handle_replies' }[] = [
    { label: 'Suggest searches', icon: Search, action: 'search', send: '' },
    { label: 'What campaign should I run?', icon: Rocket, action: 'campaign', send: '' },
    { label: 'Handle my replies', icon: MessageSquare, action: 'status', send: 'Handle the replies waiting on me.', intent: 'handle_replies' },
    { label: 'How’s my campaign?', icon: ArrowRight, action: 'status', send: 'How is my campaign doing?', intent: 'check_status' },
];

export function CopilotConversation({ variant, onClose }: { variant: 'fullscreen' | 'panel'; onClose?: () => void }) {
    // Conversation state is owned by the layout-level provider so it survives
    // route navigation and (via localStorage) reloads. This component is a view.
    const { messages, setMessages, importedLeadIds, hydrated,
        threads, activeThreadId, newThread, switchThread, deleteThread,
        workspaceContext, setWorkspaceContext } = useCopilot();
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
    // Same trick for "broaden THIS failed search" (distinct from rotate — keeps the
    // subject the user asked for instead of pivoting to a different segment).
    const broadenSearchRef = useRef<((label: string, keywords: string, filters?: SearchRecommendation['filters']) => void) | null>(null);
    // The unanswered-reply queue for handle_replies — draft one card at a time.
    const repliesQueueRef = useRef<WaitingReply[]>([]);
    const replyIdxRef = useRef(0);

    // Keep the last 40 text messages (roughly twenty exchanges). The transcript
    // remains bounded, while retaining enough context for corrections, objectives,
    // and campaign decisions to survive a longer working conversation.
    const historyForRouter = useCallback((): HistoryMsg[] => {
        return messagesRef.current
            .filter((m): m is Extract<Msg, { kind: 'text' }> => m.kind === 'text')
            .slice(-40)
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
        push({ id: sId, role: 'qampi', kind: 'searching', label: `Searching LinkedIn for “${label}”`, detail: 'Using your selected filters to find relevant prospects.' });
        try {
            // Dedup + saturation are now server-side (durable search memory), so the
            // returned people are already fresh and we get a mined-out signal back.
            const res = await runSearch(keywords, filters, page, label);
            track('copilot_search_run', { via: res.via, count: res.people.length, page, saturation: res.saturation?.state });
            setMessages((prev) => prev.filter((m) => m.id !== sId));
            const people = res.people;
            if (!people.length) {
                // Two very different reasons a page comes back empty — don't conflate them:
                //   • pageCount === 0 → LinkedIn matched NOBODY for this query (usually too
                //     narrow). Saying "you've already seen everyone" here is just wrong when
                //     the user has never searched.
                //   • pageCount > 0 but all deduped → they genuinely saw these already.
                const noMatches = (res.saturation?.pageCount ?? 0) === 0;
                push({
                    id: nextId(), role: 'qampi', kind: 'text',
                    text: page > 1
                        ? 'That’s everyone fresh for this angle — you’ve already seen the rest. Here’s a different angle to try:'
                        : noMatches
                            ? 'That search didn’t match anyone on LinkedIn — the filters are probably too narrow. Let me broaden it:'
                            : 'Everyone this search finds is already in your leads. Let me suggest a different angle:',
                });
                // Zero matches on the first page = too narrow → BROADEN the SAME
                // search (keep founders/fintech, relax filters). "Already seen
                // everyone" (deduped) or a later page → rotate to a different angle.
                if (noMatches && page === 1) broadenSearchRef.current?.(label, keywords, filters);
                else rotateAngleRef.current?.();
                return;
            }
            push({ id: nextId(), role: 'qampi', kind: 'text', text: page > 1
                ? `Found ${people.length} more. Choose what to do with them in the lead panel, or tell me how to refine the search.`
                : `I found ${people.length} people. Review the details and choose a next step in the lead panel; tell me what to change if you want to refine the search.` });
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
        push({ id: thinkId, role: 'qampi', kind: 'searching', label: 'Finding a fresh LinkedIn search angle', detail: 'The previous angle is exhausted, so I’m looking for a nearby untapped audience.' });
        try {
            const routed = await routeMessage('Suggest a different search angle for fresh leads', historyForRouter(), importedLeadIdsRef.current.length, 'find_leads');
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            if (routed.toolData?.searchDraft) {
                const d = routed.toolData.searchDraft;
                push({ id: nextId(), role: 'qampi', kind: 'searchDraft', label: d.label, keywords: d.keywords, filters: d.filters, rationale: d.rationale, reasoning: d.reasoning });
            } else {
                push({ id: nextId(), role: 'qampi', kind: 'text', text: routed.reply || 'Tell me a different type of person to look for and I’ll build a search.' });
            }
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'Tell me a different type of person to look for and I’ll build a search.' });
        }
    }, [push, historyForRouter]);
    rotateAngleRef.current = rotateAngle;

    // Broaden a search that returned NOBODY: re-ask the builder with the SAME
    // query as `broadenOf`, so it keeps the user's subject (e.g. founders in
    // fintech) and just widens the net — never pivots to a different segment.
    const broadenSearch = useCallback(async (label: string, keywords: string, filters?: SearchRecommendation['filters']) => {
        track('copilot_broaden_search', {});
        const thinkId = nextId();
        push({ id: thinkId, role: 'qampi', kind: 'searching', label: 'Broadening the search while keeping your target', detail: 'The earlier query was too narrow, so I’m relaxing filters without changing your audience.' });
        try {
            const routed = await routeMessage(
                `Broaden this search — it returned nobody: ${keywords}`,
                historyForRouter(), importedLeadIdsRef.current.length, 'find_leads',
                { keywords, filters },
            );
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            if (routed.toolData?.searchDraft) {
                const d = routed.toolData.searchDraft;
                push({ id: nextId(), role: 'qampi', kind: 'searchDraft', label: d.label, keywords: d.keywords, filters: d.filters, rationale: d.rationale, reasoning: d.reasoning });
            } else {
                push({ id: nextId(), role: 'qampi', kind: 'text', text: routed.reply || 'Tell me a different type of person to look for and I’ll build a search.' });
            }
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'Tell me a different type of person to look for and I’ll build a search.' });
        }
    }, [push, historyForRouter]);
    broadenSearchRef.current = broadenSearch;

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
            patch(cardId, { draft: d.text, initialDraft: d.text, harnessTurnId: d.harnessTurnId, rationale: d.rationale, state: 'ready' } as Partial<Msg>);
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
            if (m.harnessTurnId) void updateCopilotHarnessTurn(m.harnessTurnId, {
                outcome: 'sent',
                edited: m.draft.trim() !== (m.initialDraft || '').trim(),
                outputChars: m.draft.trim().length,
            }).catch(() => undefined);
            patch(msgId, { state: 'sent' } as Partial<Msg>);
        } catch {
            if (m.harnessTurnId) void updateCopilotHarnessTurn(m.harnessTurnId, { outcome: 'send_failed', errorCode: 'send_failed' }).catch(() => undefined);
            patch(msgId, { state: 'error', error: 'Couldn’t queue that reply. Try again in a moment.' } as Partial<Msg>);
        }
    }, [patch]);

    // Regenerate the current draft in a warmer tone.
    const tryWarmerReply = useCallback(async (msgId: string) => {
        const m = messagesRef.current.find((x) => x.id === msgId);
        if (!m || m.kind !== 'replyDraft') return;
        if (m.harnessTurnId) void updateCopilotHarnessTurn(m.harnessTurnId, {
            outcome: 'regenerated',
            edited: m.draft.trim() !== (m.initialDraft || '').trim(),
        }).catch(() => undefined);
        patch(msgId, { state: 'drafting' } as Partial<Msg>);
        try {
            const d = await draftReply(m.leadId, 'warm');
            patch(msgId, { draft: d.text, initialDraft: d.text, harnessTurnId: d.harnessTurnId, editedRecorded: false, rationale: d.rationale, tone: 'warm', state: 'ready' } as Partial<Msg>);
        } catch {
            patch(msgId, { state: 'error', error: 'Couldn’t re-draft that. Try again.' } as Partial<Msg>);
        }
    }, [patch]);

    const editReplyDraft = useCallback((msgId: string, text: string) => {
        const m = messagesRef.current.find((x) => x.id === msgId);
        if (m?.kind === 'replyDraft' && m.harnessTurnId && !m.editedRecorded && text !== m.initialDraft) {
            void updateCopilotHarnessTurn(m.harnessTurnId, { outcome: 'edited', edited: true }).catch(() => undefined);
        }
        patch(msgId, { draft: text, ...(m?.kind === 'replyDraft' && text !== m.initialDraft ? { editedRecorded: true } : {}) } as Partial<Msg>);
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

    // Web search now runs server-side (research-agent on the db box). The
    // extension is no longer involved, so there is no permission step and no
    // install requirement — the old browser providers were a hard block
    // (DuckDuckGo) and unrelated results (Bing RSS).
    const runWebSearch = useCallback(async (msgId: string, query: string) => {
        patch(msgId, { state: 'searching', error: undefined });
        try {
            const summary = await searchAndSummarizeWeb(query);
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
            push({
                id: nextId(),
                role: 'qampi',
                kind: 'researchBrief',
                query,
                reply: summary.reply || 'I found public sources, but could not create a summary.',
                sources: summary.sources,
            });
        } catch (error: unknown) {
            // Surface what actually failed. The old path reported every failure
            // as "No web results found. Try a shorter query.", which blamed the
            // user's wording for a dead provider.
            const apiMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
            const message = typeof apiMessage === 'string' && apiMessage
                ? apiMessage
                : error instanceof Error ? error.message : 'Web search failed.';
            patch(msgId, { state: 'error', error: message });
        }
    }, [patch, push, setMessages]);

    // Free-text (or a quick-action chip) → intent router → the right closed
    // action (or an honest reply).
    const runMessage = useCallback(async (q: string, intentHint?: 'check_status' | 'handle_replies' | 'find_leads') => {
        if (!q.trim()) return;
        if (!started) setStarted(true);
        push({ id: nextId(), role: 'user', kind: 'text', text: q });
        const thinkId = nextId();
        push({ id: thinkId, role: 'qampi', kind: 'searching', label: 'Understanding your request and choosing the next step', detail: 'I’m matching it to the right Qampi action and checking what information it needs.' });
        try {
            const contextualQuery = workspaceContext
                ? `${q}\n\nCurrent dashboard context: ${workspaceContext.label}${workspaceContext.detail ? ` — ${workspaceContext.detail}` : ''}.`
                : q;
            const routed = await routeMessage(contextualQuery, historyForRouter(), importedLeadIdsRef.current.length, intentHint);
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            // Web-search availability is determined in the browser below. Do not
            // render the router's generic “approve the search” sentence first:
            // it can be stale once permission is already granted and auto-run.
            if (routed.reply && routed.intent !== 'web_search') push({ id: nextId(), role: 'qampi', kind: 'text', text: routed.reply });
            if (routed.intent === 'find_leads') {
                // Show the reasoned query first (approve/edit before spending a search);
                // fall back to a raw-phrase search if the builder didn't return one.
                if (routed.toolData?.searchDraft) {
                    const d = routed.toolData.searchDraft;
                    push({ id: nextId(), role: 'qampi', kind: 'searchDraft', label: d.label, keywords: d.keywords, filters: d.filters, rationale: d.rationale, reasoning: d.reasoning });
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
            } else if (routed.intent === 'web_search') {
                // Runs server-side, so there is nothing to install, nothing to
                // permit, and no second button to click — just search.
                const query = routed.params.keywords || q;
                const webSearchId = nextId();
                push({ id: webSearchId, role: 'qampi', kind: 'webSearch', query, state: 'searching' });
                void runWebSearch(webSearchId, query);
            }
            // lookup_lead / check_status / explain / unsupported / off_topic → the reply already said it.
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== thinkId));
            push({ id: nextId(), role: 'qampi', kind: 'text', text: 'I had trouble with that — try rephrasing, or tell me the kind of people you want to reach.' });
        }
    }, [started, push, doSearch, recommendCampaigns, offerLaunch, handleReplies, historyForRouter, runWebSearch, workspaceContext]);

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
                        onPickTemplate={offerLaunch}
                        onLaunch={runLaunch}
                        onSendReply={sendReplyDraft}
                        onTryWarmer={tryWarmerReply}
                        onEditReply={editReplyDraft}
                        onDraftNext={draftNextReply}
                        onBackToProspecting={backToProspecting}
                        onRunWebSearch={runWebSearch}
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
                                else { track('copilot_quickprompt', { action: 'status' }); runMessage(qp.send, qp.intent); }
                            }}
                            className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-medium bg-surface border border-line rounded-chip px-2.5 py-1.5 text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand transition-colors whitespace-nowrap"
                        >
                            <qp.icon className="w-3 h-3 text-brand" /> {qp.label}
                        </button>
                    ))}
                </div>
                {workspaceContext && (
                    <div className="mb-2 flex items-center gap-2 rounded-control bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-700">
                        <span className="text-brand-500">Working with</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{workspaceContext.label}{workspaceContext.detail ? ` · ${workspaceContext.detail}` : ''}</span>
                        <button type="button" onClick={() => setWorkspaceContext(null)} aria-label="Clear workspace context" className="text-brand-500 hover:text-brand-700">×</button>
                    </div>
                )}
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

function MessageRow({ m, onPickSearch, onRunDraft, onPickTemplate, onLaunch, onSendReply, onTryWarmer, onEditReply, onDraftNext, onBackToProspecting, onRunWebSearch }: {
    m: Msg;
    onPickSearch: (label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onRunDraft: (msgId: string, label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onPickTemplate: (templateId: string, label: string) => void;
    onLaunch: (msgId: string, overrides?: LaunchOverrides) => void;
    onSendReply: (msgId: string) => void;
    onTryWarmer: (msgId: string) => void;
    onEditReply: (msgId: string, text: string) => void;
    onDraftNext: () => void;
    onBackToProspecting: () => void;
    onRunWebSearch: (msgId: string, query: string, requestPermission?: boolean) => void;
}) {
    if (m.kind === 'text') {
        return m.role === 'user'
            ? <div className="flex justify-end"><div className="max-w-[80%] bg-brand text-white text-[13px] px-3.5 py-2 rounded-card rounded-tr-chip whitespace-pre-wrap">{m.text}</div></div>
            : <QBubble><RichText text={m.text} /></QBubble>;
    }
    if (m.kind === 'understand') return <QBubble><UnderstandCard loading={m.loading} data={m.data} /></QBubble>;
    if (m.kind === 'searchChips') return <div className="pl-8"><SearchChips loading={m.loading} recs={m.recs} onPick={onPickSearch} /></div>;
    if (m.kind === 'searchDraft') return <div className="pl-8"><SearchDraftCard m={m} onRun={onRunDraft} /></div>;
    if (m.kind === 'webSearch') return <div className="pl-8"><WebSearchCard m={m} onRun={onRunWebSearch} /></div>;
    if (m.kind === 'researchBrief') return <div className="pl-8"><ResearchBriefCard m={m} /></div>;
    if (m.kind === 'searching') return <QBubble><AgentProgress label={m.label} detail={m.detail} /></QBubble>;
    if (m.kind === 'results') return <QBubble><p>These leads are ready in the panel. Choose an option there and I&rsquo;ll stay in sync; or tell me how you&rsquo;d like to refine the search.</p></QBubble>;
    if (m.kind === 'templates') return <div className="pl-8"><TemplatePicks loading={m.loading} picks={m.picks} onPick={onPickTemplate} /></div>;
    if (m.kind === 'launchConfirm') return <div className="pl-8"><LaunchConfirm m={m} onLaunch={onLaunch} /></div>;
    if (m.kind === 'replyDraft') return <div className="pl-8"><ReplyDraftCard m={m} onSend={onSendReply} onTryWarmer={onTryWarmer} onEdit={onEditReply} onDraftNext={onDraftNext} onBackToProspecting={onBackToProspecting} /></div>;
    if (m.kind === 'reconnect') return <QBubble><ReconnectNotice /></QBubble>;
    return null;
}

function WebSearchCard({ m, onRun }: { m: Extract<Msg, { kind: 'webSearch' }>; onRun: (msgId: string, query: string) => void }) {
    // Only two states remain now that search is server-side: it is running, or
    // it failed and can be retried. The install/permission states belonged to
    // the extension path and no longer exist.
    return (
        <div className="bg-card border border-line rounded-card p-3 space-y-2.5">
            <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-[13px] font-medium text-foreground">Web search</span>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-500">
                {m.state === 'error' ? m.error : `Finding public sources for \u201c${m.query}\u201d\u2026`}
            </p>
            {m.state === 'error' ? (
                <button onClick={() => onRun(m.id, m.query)} className="inline-flex items-center gap-2 text-[13px] font-medium bg-brand text-white rounded-chip px-3.5 py-2 hover:bg-brand-600 transition-colors">
                    <Search className="w-3.5 h-3.5" /> Try again
                </button>
            ) : (
                <AgentProgress compact label="Finding sources and preparing a summary" />
            )}
        </div>
    );
}

// Public research deserves a distinct, scan-friendly surface. The model's
// grounded answer stays intact, while source provenance is deliberately kept
// behind a disclosure instead of consuming the whole conversation viewport.
function ResearchBriefCard({ m }: { m: Extract<Msg, { kind: 'researchBrief' }> }) {
    const title = researchTitle(m.query);
    const sourceLabel = m.sources.length === 1 ? '1 source checked' : `${m.sources.length} sources checked`;

    return (
        <Card className="max-w-[96%] overflow-hidden border-brand-100 shadow-none">
            <CardBody className="p-0">
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-brand-50 text-brand">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">Research brief</p>
                            <Badge tone="success" className="!px-1.5 !py-0.5 !text-[10px]" dot>Grounded</Badge>
                        </div>
                        <h3 className="mt-0.5 text-[14px] font-semibold leading-snug text-foreground">{title}</h3>
                    </div>
                </div>

                <div className="mx-4 border-y border-line bg-surface/55 px-3.5 py-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Bottom line
                    </div>
                    <div className="text-[13px] leading-relaxed text-ink-700 [&_strong]:text-foreground [&_strong]:font-semibold">
                        <RichText text={m.reply} />
                    </div>
                </div>

                <details className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-medium text-ink-600 hover:text-brand">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-surface text-ink-500 group-open:bg-brand-50 group-open:text-brand"><ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" /></span>
                        {sourceLabel}
                    </summary>
                    <div className="mt-2.5 space-y-1.5 border-l-2 border-brand-100 pl-3">
                        {m.sources.length ? m.sources.map((source) => (
                            <a
                                key={source.url}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-500 hover:text-brand"
                            >
                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>{source.title}</span>
                            </a>
                        )) : <p className="text-[11px] text-ink-500">No source links were returned for this brief.</p>}
                    </div>
                </details>
            </CardBody>
        </Card>
    );
}

function researchTitle(query: string): string {
    const clean = query.replace(/\s+/g, ' ').trim();
    const company = clean
        .replace(/^(what(?:'s| is)|who is|tell me about|research)\s+/i, '')
        .replace(/(?:'s|’s)?\s+(main\s+)?(ideal customer profile|icp|target market).*$/i, '')
        .replace(/\?+$/, '')
        .trim();
    if (/(ideal customer profile|\bicp\b|target market)/i.test(clean)) return `${company || 'Company'} — ICP brief`;
    return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean || 'Research brief';
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
            {m.reasoning && <DecisionContext text={m.reasoning} />}
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
                <AgentProgress compact label="Drafting a reply" />
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

// Inline markdown-lite: **bold**, *italic*, `code`. Built from React nodes (no
// dangerouslySetInnerHTML) so lead/AI text can never inject markup.
function renderInline(s: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*)/g;
    let last = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = re.exec(s)) !== null) {
        if (m.index > last) nodes.push(s.slice(last, m.index));
        if (m[2] !== undefined) nodes.push(<strong key={k++} className="font-semibold text-foreground">{m[2]}</strong>);
        else if (m[3] !== undefined) nodes.push(<code key={k++} className="text-[12px] font-mono bg-surface text-ink-700 px-1 py-0.5 rounded">{m[3]}</code>);
        else if (m[4] !== undefined) nodes.push(<em key={k++}>{m[4]}</em>);
        last = m.index + m[0].length;
    }
    if (last < s.length) nodes.push(s.slice(last));
    return nodes;
}

// Render a bounded, safe subset of Markdown. Research replies regularly carry
// headings, ordered recommendations, and compact decision-maker tables; raw
// HTML is intentionally never interpreted.
function RichText({ text }: { text: string }) {
    const lines = (text || '').trim().split('\n');
    if (!lines.length || !lines.some((line) => line.trim())) return null;
    const blocks: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i += 1; continue; }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            const Tag = heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4';
            blocks.push(<Tag key={key++} className={cn('font-semibold text-foreground tracking-tight', heading[1].length === 1 ? 'text-[16px] mt-1' : 'text-[14px] mt-1')}>{renderInline(heading[2])}</Tag>);
            i += 1;
            continue;
        }

        // GitHub-style table: header row, separator row, then zero or more rows.
        if (isMarkdownTableRow(line) && i + 1 < lines.length && isMarkdownTableDivider(lines[i + 1])) {
            const headers = markdownTableCells(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && isMarkdownTableRow(lines[i])) {
                rows.push(markdownTableCells(lines[i]));
                i += 1;
            }
            blocks.push(
                <div key={key++} className="overflow-x-auto rounded-control border border-line bg-card">
                    <table className="min-w-[540px] w-full border-collapse text-left text-[11px] leading-snug">
                        <thead className="bg-surface text-ink-500">
                            <tr>{headers.map((header, cellIndex) => <th key={cellIndex} className="border-b border-line px-2.5 py-2 font-semibold">{renderInline(header)}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="align-top">
                                    {headers.map((_, cellIndex) => <td key={cellIndex} className="px-2.5 py-2 text-ink-700">{renderInline(row[cellIndex] || '')}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>,
            );
            continue;
        }

        const unordered = /^\s*[-•]\s+/.test(line);
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        if (unordered || ordered) {
            const entries: string[] = [];
            const pattern = unordered ? /^\s*[-•]\s+/ : /^\s*\d+[.)]\s+/;
            while (i < lines.length && pattern.test(lines[i])) {
                entries.push(lines[i].replace(pattern, ''));
                i += 1;
            }
            const List = ordered ? 'ol' : 'ul';
            blocks.push(<List key={key++} className={cn('space-y-1 pl-4 marker:text-brand', ordered ? 'list-decimal' : 'list-disc')}>
                {entries.map((entry, entryIndex) => <li key={entryIndex}>{renderInline(entry)}</li>)}
            </List>);
            continue;
        }

        const paragraph: string[] = [line];
        i += 1;
        while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,3})\s+/) && !isMarkdownTableRow(lines[i]) && !/^\s*[-•]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
            paragraph.push(lines[i]);
            i += 1;
        }
        blocks.push(<p key={key++}>{paragraph.map((part, partIndex) => <span key={partIndex}>{renderInline(part)}{partIndex < paragraph.length - 1 && <br />}</span>)}</p>);
    }

    return <div className="space-y-2.5">{blocks}</div>;
}

function isMarkdownTableRow(line: string): boolean {
    return line.includes('|') && markdownTableCells(line).length > 1;
}

function isMarkdownTableDivider(line: string): boolean {
    const cells = markdownTableCells(line);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function markdownTableCells(line: string): string[] {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
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

function AgentProgress({ label, detail, compact = false }: { label: string; detail?: string; compact?: boolean }) {
    return (
        <div className={cn('flex items-start gap-2.5 text-ink-500', compact ? 'text-[12px]' : 'text-[13px]')}>
            <TypingLoader size="sm" className="mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="font-medium text-ink-600">{label}</p>
                <WorkTrace label={label} detail={detail} />
            </div>
        </div>
    );
}

function WorkTrace({ label, detail }: { label: string; detail?: string }) {
    const lower = label.toLowerCase();
    const steps = lower.includes('search')
        ? ['Interpret the target and filters', 'Check for a fresh lead angle', 'Search matching LinkedIn profiles']
        : lower.includes('reply')
            ? ['Read the lead’s message', 'Match the agreed tone and goal', 'Prepare an editable reply']
            : lower.includes('campaign')
                ? ['Review the selected leads', 'Compare viable campaign flows', 'Prepare the best-fit recommendation']
                : ['Interpret your request', 'Choose the right Qampi action', 'Prepare the next step'];

    return (
        <Reasoning className="mt-1.5">
            <ReasoningTrigger className="text-[11px] text-ink-400 transition-colors hover:text-ink-600">
                <Sparkles className="h-3 w-3 shrink-0 text-brand" /> View Qampi&apos;s work
            </ReasoningTrigger>
            <ReasoningContent contentClassName="mt-1.5 border-l-2 border-brand-100 pl-2.5 text-[11px] leading-relaxed">
                <ol className="space-y-1.5">
                    {steps.map((step, index) => (
                        <li key={step} className="flex items-center gap-2">
                            <span className={cn('grid h-4 w-4 place-items-center rounded-full text-[9px] font-semibold', index === steps.length - 1 ? 'bg-brand text-white' : 'bg-brand-50 text-brand')}>
                                {index === steps.length - 1 ? <TypingLoader size="sm" className="scale-75" /> : <Check className="h-2.5 w-2.5" />}
                            </span>
                            <span className={index === steps.length - 1 ? 'text-ink-700' : 'text-ink-500'}>{step}</span>
                        </li>
                    ))}
                </ol>
                {detail && <p className="mt-2 border-t border-line pt-2 text-ink-400">Why now: {detail}</p>}
            </ReasoningContent>
        </Reasoning>
    );
}

function DecisionContext({ text, label = 'How Qampi chose this' }: { text: string; label?: string }) {
    return (
        <Reasoning className="mt-1.5">
            <ReasoningTrigger className="text-[11px] text-ink-400 transition-colors hover:text-ink-600">
                <Sparkles className="h-3 w-3 shrink-0 text-brand" /> {label}
            </ReasoningTrigger>
            <ReasoningContent contentClassName="mt-1.5 border-l-2 border-brand-100 pl-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">
                {text}
            </ReasoningContent>
        </Reasoning>
    );
}

function UnderstandCard({ loading, data }: { loading: boolean; data?: Understand }) {
    if (loading) return <AgentProgress compact label="Reading your profile" />;
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
    if (loading) return <AgentProgress compact label="Reviewing your profile to prepare targeted searches" />;
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

function TemplatePicks({ loading, picks, onPick }: { loading: boolean; picks?: TemplatePick[]; onPick: (id: string, label: string) => void }) {
    if (loading) return <AgentProgress compact label="Matching campaigns to your goal" />;
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
