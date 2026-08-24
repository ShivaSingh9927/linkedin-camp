'use client';

// The activation copilot conversation engine — shared by the full-screen first-run
// takeover and the permanent dashboard panel. Layout-agnostic: it fills its
// container and drives the flow understand → recommend search → run search →
// results + import → recommend templates. `variant` only changes the opening
// behavior: 'fullscreen' auto-starts (understand card + search chips); 'panel'
// stays quiet until the user asks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Search, Loader2, ArrowUp, Check, Plus, MapPin, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
    fetchUnderstand, fetchSearchRecommendations, runSearch, importPeople, fetchTemplateRecommendations,
    type Understand, type SearchRecommendation, type SearchPerson, type TemplatePick,
} from './copilotApi';

type Msg =
    | { id: string; role: 'qampi' | 'user'; kind: 'text'; text: string }
    | { id: string; role: 'qampi'; kind: 'understand'; loading: boolean; data?: Understand }
    | { id: string; role: 'qampi'; kind: 'searchChips'; loading: boolean; recs?: SearchRecommendation[] }
    | { id: string; role: 'qampi'; kind: 'searching'; label: string }
    | { id: string; role: 'qampi'; kind: 'results'; people: SearchPerson[]; via: string; remaining: number; cap: number }
    | { id: string; role: 'qampi'; kind: 'templates'; loading: boolean; picks?: TemplatePick[] };

let _id = 0;
const nextId = () => `m${Date.now()}_${_id++}`;

export function CopilotConversation({ variant, onClose }: { variant: 'fullscreen' | 'panel'; onClose?: () => void }) {
    const router = useRouter();
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [started, setStarted] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const taRef = useRef<HTMLTextAreaElement | null>(null);

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

    useEffect(() => {
        if (variant === 'fullscreen') start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variant]);

    const doSearch = useCallback(async (label: string, keywords: string, filters?: SearchRecommendation['filters']) => {
        push({ id: nextId(), role: 'user', kind: 'text', text: label });
        const sId = nextId();
        push({ id: sId, role: 'qampi', kind: 'searching', label });
        try {
            const res = await runSearch(keywords, filters);
            track('copilot_search_run', { via: res.via, count: res.people.length });
            setMessages((prev) => prev.filter((m) => m.id !== sId));
            if (!res.people.length) {
                push({ id: nextId(), role: 'qampi', kind: 'text', text: 'I couldn’t pull results for that one. Try another search or rephrase it.' });
                return;
            }
            push({ id: nextId(), role: 'qampi', kind: 'text', text: `Found ${res.people.length} people. Pick the ones you want and I’ll import them.` });
            push({ id: nextId(), role: 'qampi', kind: 'results', people: res.people, via: res.via, remaining: res.remaining, cap: res.cap });
        } catch (e) {
            setMessages((prev) => prev.filter((m) => m.id !== sId));
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'That search didn’t go through. Try again in a moment.';
            push({ id: nextId(), role: 'qampi', kind: 'text', text: msg });
        }
    }, [push]);

    const afterImport = useCallback(async (count: number) => {
        push({ id: nextId(), role: 'qampi', kind: 'text', text: `Imported ${count} lead${count === 1 ? '' : 's'}. Here are campaigns that fit — pick one to launch.` });
        const tId = nextId();
        push({ id: tId, role: 'qampi', kind: 'templates', loading: true });
        try {
            const { picks } = await fetchTemplateRecommendations();
            patch(tId, { loading: false, picks });
        } catch {
            patch(tId, { loading: false, picks: [] });
        }
    }, [push, patch]);

    const submitInput = useCallback(() => {
        const q = input.trim();
        if (!q) return;
        setInput('');
        if (!started) setStarted(true);
        doSearch(q, q);
    }, [input, started, doSearch]);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line shrink-0">
                <div className="w-7 h-7 rounded-chip bg-brand-50 grid place-items-center text-brand">
                    <Sparkles className="w-4 h-4" />
                </div>
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
                {variant === 'panel' && !started && <PanelResting onFindLeads={() => { setStarted(true); track('copilot_opened', { variant: 'panel' }); loadSearchChips(); }} />}

                {messages.map((m) => (
                    <MessageRow
                        key={m.id}
                        m={m}
                        onPickSearch={doSearch}
                        onImported={afterImport}
                        onPickTemplate={(id) => { track('copilot_template_selected', { templateId: id }); router.push(`/campaigns?template=${encodeURIComponent(id)}`); }}
                    />
                ))}
            </div>

            {/* composer */}
            <div className="shrink-0 px-3 py-3 border-t border-line">
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

function PanelResting({ onFindLeads }: { onFindLeads: () => void }) {
    return (
        <div className="space-y-3">
            <QBubble>
                <p>Hi — I’m here whenever you want to find leads or start a campaign. Want me to suggest some searches?</p>
            </QBubble>
            <div className="pl-8">
                <button
                    onClick={onFindLeads}
                    className="inline-flex items-center gap-2 text-[13px] font-medium bg-card border border-line rounded-chip px-3 py-2 hover:border-brand-200 hover:bg-brand-50 transition-colors"
                >
                    <Search className="w-3.5 h-3.5 text-brand" /> Find leads for me
                </button>
            </div>
        </div>
    );
}

function MessageRow({ m, onPickSearch, onImported, onPickTemplate }: {
    m: Msg;
    onPickSearch: (label: string, keywords: string, filters?: SearchRecommendation['filters']) => void;
    onImported: (count: number) => void;
    onPickTemplate: (templateId: string) => void;
}) {
    if (m.kind === 'text') {
        return m.role === 'user'
            ? <div className="flex justify-end"><div className="max-w-[80%] bg-brand text-white text-[13px] px-3.5 py-2 rounded-card rounded-tr-chip">{m.text}</div></div>
            : <QBubble>{m.text}</QBubble>;
    }
    if (m.kind === 'understand') return <QBubble><UnderstandCard loading={m.loading} data={m.data} /></QBubble>;
    if (m.kind === 'searchChips') return <div className="pl-8"><SearchChips loading={m.loading} recs={m.recs} onPick={onPickSearch} /></div>;
    if (m.kind === 'searching') return <QBubble><span className="inline-flex items-center gap-2 text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Searching LinkedIn for “{m.label}”…</span></QBubble>;
    if (m.kind === 'results') return <div className="pl-8"><ResultsBlock people={m.people} onImported={onImported} /></div>;
    if (m.kind === 'templates') return <div className="pl-8"><TemplatePicks loading={m.loading} picks={m.picks} onPick={onPickTemplate} /></div>;
    return null;
}

function QBubble({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-chip bg-brand-50 grid place-items-center text-brand shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
            </div>
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

function ResultsBlock({ people, onImported }: { people: SearchPerson[]; onImported: (count: number) => void }) {
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
            const { importedTotal } = await importPeople(chosen);
            const n = importedTotal || chosen.length;
            track('leads_imported', { count: n, source: 'copilot' });
            setDone(n);
            onImported(n);
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
        </div>
    );
}

function TemplatePicks({ loading, picks, onPick }: { loading: boolean; picks?: TemplatePick[]; onPick: (id: string) => void }) {
    if (loading) return <span className="inline-flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Matching campaigns to your goal…</span>;
    if (!picks || !picks.length) return <Link href="/campaigns" className="text-[13px] text-brand hover:underline">Browse campaign templates →</Link>;
    return (
        <div className="flex flex-col gap-2">
            {picks.map((t) => (
                <button
                    key={t.templateId}
                    onClick={() => onPick(t.templateId)}
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
