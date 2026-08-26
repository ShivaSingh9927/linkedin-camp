'use client';

// The single source of truth for the activation copilot — now MULTI-THREAD.
//
// WHY this lives in the root layout, not the chat component: in the App Router
// the layout stays mounted across route navigation — only the page swaps. So a
// provider here survives `/` → `/campaigns` → `/` for free (SPA nav never wipes
// the thread). localStorage write-through backs it up across hard reloads / new
// tabs / next-day visits — on the same browser.
//
// Threads model (decided with the user):
//   • Conversation history is per-DEVICE localStorage — the backend never needs
//     it (each message is routed with only the active thread's recent window), so
//     token cost stays flat no matter how many threads exist.
//   • An index (id/title/updatedAt) + one blob per thread. LRU-capped so we never
//     approach the ~5MB origin budget; writes are quota-guarded (evict + retry).
//   • GLOBAL memory (who you are + recent campaign) is NOT stored here — it's
//     composed server-side per message, so every thread starts already grounded.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Msg } from './copilotTypes';
import { toDurableMessages } from './copilotTypes';

export interface ThreadMeta {
    id: string;
    title: string;
    updatedAt: number;
}

interface CopilotState {
    messages: Msg[];
    setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
    importedLeadIds: string[];
    setImportedLeadIds: React.Dispatch<React.SetStateAction<string[]>>;
    hydrated: boolean;
    reset: () => void;
    // threads
    threads: ThreadMeta[];
    activeThreadId: string;
    newThread: () => void;
    switchThread: (id: string) => void;
    renameThread: (id: string, title: string) => void;
    deleteThread: (id: string) => void;
}

const CopilotContext = createContext<CopilotState | null>(null);

const INDEX_PREFIX = 'qampi.copilot.index.'; // the thread index (per user)
const THREAD_PREFIX = 'qampi.copilot.t.';    // one blob per thread
const OLD_PREFIX = 'qampi.copilot.thread.';  // pre-threads single conversation (migrate from)
const V = 2;
const MAX_THREADS = 30;
const DEFAULT_TITLE = 'New chat';

// Per-user namespace so two accounts on the same browser don't share history.
function whoKey(): string {
    let who = 'anon';
    try {
        const raw = localStorage.getItem('user');
        if (raw) { const u = JSON.parse(raw); who = u?.id || u?.email || 'anon'; }
    } catch { /* ignore */ }
    return who;
}
const indexKey = (w: string) => `${INDEX_PREFIX}${w}`;
const threadKey = (w: string, id: string) => `${THREAD_PREFIX}${w}.${id}`;
const oldKey = (w: string) => `${OLD_PREFIX}${w}`;

// Thread ids + timestamps are generated in effects/handlers (never render), so
// Date.now() is fine here (the purity lint only fires in a render body).
let _tc = 0;
const newThreadId = () => `t${Date.now().toString(36)}${(_tc++).toString(36)}`;

// Auto-title a thread from its first user message; falls back to "New chat".
function titleFrom(messages: Msg[]): string {
    const first = messages.find((m) => m.kind === 'text' && m.role === 'user') as Extract<Msg, { kind: 'text' }> | undefined;
    const t = first?.text?.trim();
    if (!t) return DEFAULT_TITLE;
    return t.length > 42 ? `${t.slice(0, 41)}…` : t;
}

interface ThreadBlob { v: number; messages: Msg[]; importedLeadIds: string[] }
interface IndexBlob { v: number; threads: ThreadMeta[]; activeThreadId: string }

// setItem that survives a full disk: on QuotaExceededError, evict the oldest
// thread's blob and retry once. A search must never fail because history filled up.
function safeSet(w: string, key: string, val: string) {
    try { localStorage.setItem(key, val); return; } catch { /* fall through to evict */ }
    try {
        const idxRaw = localStorage.getItem(indexKey(w));
        if (idxRaw) {
            const idx = JSON.parse(idxRaw) as IndexBlob;
            const oldest = [...(idx.threads || [])].sort((a, b) => a.updatedAt - b.updatedAt)[0];
            if (oldest) localStorage.removeItem(threadKey(w, oldest.id));
        }
        localStorage.setItem(key, val);
    } catch { /* give up — in-memory thread still works */ }
}

function writeThread(w: string, id: string, messages: Msg[], importedLeadIds: string[]) {
    const blob: ThreadBlob = { v: V, messages: toDurableMessages(messages), importedLeadIds };
    safeSet(w, threadKey(w, id), JSON.stringify(blob));
}
function writeIndex(w: string, threads: ThreadMeta[], activeThreadId: string) {
    const blob: IndexBlob = { v: V, threads, activeThreadId };
    safeSet(w, indexKey(w), JSON.stringify(blob));
}
function readThread(w: string, id: string): ThreadBlob {
    try {
        const raw = localStorage.getItem(threadKey(w, id));
        if (raw) {
            const b = JSON.parse(raw) as ThreadBlob;
            if (b?.v === V) return { v: V, messages: Array.isArray(b.messages) ? b.messages : [], importedLeadIds: Array.isArray(b.importedLeadIds) ? b.importedLeadIds : [] };
        }
    } catch { /* corrupt — treat as empty */ }
    return { v: V, messages: [], importedLeadIds: [] };
}

export function CopilotProvider({ children }: { children: React.ReactNode }) {
    const [messages, setMessages] = useState<Msg[]>([]);
    const [importedLeadIds, setImportedLeadIds] = useState<string[]>([]);
    const [threads, setThreads] = useState<ThreadMeta[]>([]);
    const [activeThreadId, setActiveThreadId] = useState('');
    // Starts false so server + first client render agree (empty). We rehydrate in
    // an effect, then flip hydrated → the conversation reads the restored thread.
    const [hydrated, setHydrated] = useState(false);
    const whoRef = useRef('');

    // Hydrate once on mount (client only). Loads the index, or migrates the old
    // single-conversation blob into thread #1, or starts one empty thread.
    useEffect(() => {
        const w = whoKey();
        whoRef.current = w;
        try {
            const idxRaw = localStorage.getItem(indexKey(w));
            if (idxRaw) {
                const idx = JSON.parse(idxRaw) as IndexBlob;
                if (idx?.v === V && Array.isArray(idx.threads) && idx.threads.length) {
                    const act = idx.threads.some((t) => t.id === idx.activeThreadId) ? idx.activeThreadId : idx.threads[0].id;
                    const blob = readThread(w, act);
                    setThreads(idx.threads);
                    setActiveThreadId(act);
                    setMessages(blob.messages);
                    setImportedLeadIds(blob.importedLeadIds);
                    setHydrated(true);
                    return;
                }
            }
            // Migrate the pre-threads single conversation, if present.
            const oldRaw = localStorage.getItem(oldKey(w));
            if (oldRaw) {
                const old = JSON.parse(oldRaw) as { messages?: Msg[]; importedLeadIds?: string[] };
                const msgs = Array.isArray(old?.messages) ? old.messages : [];
                const imported = Array.isArray(old?.importedLeadIds) ? old.importedLeadIds : [];
                const id = newThreadId();
                const meta: ThreadMeta = { id, title: titleFrom(msgs), updatedAt: Date.now() };
                writeThread(w, id, msgs, imported);
                writeIndex(w, [meta], id);
                try { localStorage.removeItem(oldKey(w)); } catch { /* ignore */ }
                setThreads([meta]); setActiveThreadId(id); setMessages(msgs); setImportedLeadIds(imported);
                setHydrated(true);
                return;
            }
        } catch { /* corrupt/blocked — start fresh below */ }
        // Fresh: one empty thread.
        const id = newThreadId();
        const meta: ThreadMeta = { id, title: DEFAULT_TITLE, updatedAt: Date.now() };
        writeIndex(w, [meta], id);
        setThreads([meta]); setActiveThreadId(id);
        setHydrated(true);
    }, []);

    // Write-through the ACTIVE thread + index. Guarded on `hydrated` so we never
    // clobber stored state with the empty initial state before the read above.
    useEffect(() => {
        if (!hydrated || !activeThreadId) return;
        const w = whoRef.current || whoKey();
        writeThread(w, activeThreadId, messages, importedLeadIds);
        setThreads((prev) => {
            const next = prev.map((t) =>
                t.id === activeThreadId
                    ? { ...t, title: t.title === DEFAULT_TITLE ? titleFrom(messages) : t.title, updatedAt: Date.now() }
                    : t,
            );
            writeIndex(w, next, activeThreadId);
            return next;
        });
        // setThreads is intentionally excluded — it's the setter, stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, importedLeadIds, hydrated, activeThreadId]);

    const newThread = useCallback(() => {
        const w = whoRef.current || whoKey();
        const id = newThreadId();
        const meta: ThreadMeta = { id, title: DEFAULT_TITLE, updatedAt: Date.now() };
        setThreads((prev) => {
            let next = [meta, ...prev];
            if (next.length > MAX_THREADS) {
                for (const t of next.slice(MAX_THREADS)) { try { localStorage.removeItem(threadKey(w, t.id)); } catch { /* ignore */ } }
                next = next.slice(0, MAX_THREADS);
            }
            writeIndex(w, next, id);
            return next;
        });
        setActiveThreadId(id);
        setMessages([]);
        setImportedLeadIds([]);
    }, []);

    const switchThread = useCallback((id: string) => {
        setActiveThreadId((cur) => {
            if (id === cur) return cur;
            const w = whoRef.current || whoKey();
            const blob = readThread(w, id);
            setMessages(blob.messages);
            setImportedLeadIds(blob.importedLeadIds);
            setThreads((prev) => { writeIndex(w, prev, id); return prev; });
            return id;
        });
    }, []);

    const renameThread = useCallback((id: string, title: string) => {
        const clean = (title || '').trim();
        if (!clean) return;
        const w = whoRef.current || whoKey();
        setThreads((prev) => {
            const next = prev.map((t) => (t.id === id ? { ...t, title: clean } : t));
            setActiveThreadId((act) => { writeIndex(w, next, act); return act; });
            return next;
        });
    }, []);

    const deleteThread = useCallback((id: string) => {
        const w = whoRef.current || whoKey();
        try { localStorage.removeItem(threadKey(w, id)); } catch { /* ignore */ }
        setThreads((prev) => {
            const remaining = prev.filter((t) => t.id !== id);
            if (!remaining.length) {
                const nid = newThreadId();
                const meta: ThreadMeta = { id: nid, title: DEFAULT_TITLE, updatedAt: Date.now() };
                writeIndex(w, [meta], nid);
                setActiveThreadId(nid); setMessages([]); setImportedLeadIds([]);
                return [meta];
            }
            setActiveThreadId((act) => {
                if (act !== id) { writeIndex(w, remaining, act); return act; }
                const next = remaining[0].id;
                const blob = readThread(w, next);
                setMessages(blob.messages); setImportedLeadIds(blob.importedLeadIds);
                writeIndex(w, remaining, next);
                return next;
            });
            return remaining;
        });
    }, []);

    // Wipe everything for this user (logout) and start one empty thread.
    const reset = useCallback(() => {
        const w = whoRef.current || whoKey();
        try {
            const kill: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k === indexKey(w) || k.startsWith(`${THREAD_PREFIX}${w}.`) || k === oldKey(w))) kill.push(k);
            }
            kill.forEach((k) => localStorage.removeItem(k));
        } catch { /* ignore */ }
        const id = newThreadId();
        const meta: ThreadMeta = { id, title: DEFAULT_TITLE, updatedAt: Date.now() };
        writeIndex(w, [meta], id);
        setThreads([meta]); setActiveThreadId(id); setMessages([]); setImportedLeadIds([]);
    }, []);

    const value = useMemo<CopilotState>(
        () => ({
            messages, setMessages, importedLeadIds, setImportedLeadIds, hydrated, reset,
            threads, activeThreadId, newThread, switchThread, renameThread, deleteThread,
        }),
        [messages, importedLeadIds, hydrated, reset, threads, activeThreadId, newThread, switchThread, renameThread, deleteThread],
    );

    return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot(): CopilotState {
    const ctx = useContext(CopilotContext);
    if (!ctx) throw new Error('useCopilot must be used within a CopilotProvider');
    return ctx;
}
