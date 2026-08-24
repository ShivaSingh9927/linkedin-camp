'use client';

// The single source of truth for the activation copilot conversation.
//
// WHY this lives in the root layout, not the chat component: in the App Router
// the layout stays mounted across route navigation — only the page swaps. So a
// provider here survives `/` → `/campaigns` → `/` for free (SPA nav never wipes
// the thread). A localStorage write-through then backs it up so a HARD reload /
// new tab / next-day visit also restores — on the same browser. Both copilot
// surfaces (the first-run full-screen takeover and the permanent dashboard panel)
// consume this same store, so during first run — when both are mounted at once —
// there is one thread, not two competing copies.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Msg } from './copilotTypes';
import { toDurableMessages } from './copilotTypes';

interface CopilotState {
    messages: Msg[];
    setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
    importedLeadIds: string[];
    setImportedLeadIds: React.Dispatch<React.SetStateAction<string[]>>;
    hydrated: boolean;
    reset: () => void;
}

const CopilotContext = createContext<CopilotState | null>(null);

const STORAGE_PREFIX = 'qampi.copilot.thread.';
const STORAGE_VERSION = 1;

// Per-user key so two accounts on the same browser don't share a transcript.
function storageKey(): string {
    let who = 'anon';
    try {
        const raw = localStorage.getItem('user');
        if (raw) {
            const u = JSON.parse(raw);
            who = u?.id || u?.email || 'anon';
        }
    } catch { /* ignore */ }
    return `${STORAGE_PREFIX}${who}`;
}

interface Persisted {
    v: number;
    messages: Msg[];
    importedLeadIds: string[];
}

export function CopilotProvider({ children }: { children: React.ReactNode }) {
    const [messages, setMessages] = useState<Msg[]>([]);
    const [importedLeadIds, setImportedLeadIds] = useState<string[]>([]);
    // Starts false so server and first client render agree (empty). We rehydrate
    // in an effect, then flip hydrated → the conversation reads the restored thread.
    const [hydrated, setHydrated] = useState(false);
    const keyRef = useRef<string>('');

    // Hydrate once on mount (client only — localStorage doesn't exist on the server).
    useEffect(() => {
        keyRef.current = storageKey();
        try {
            const raw = localStorage.getItem(keyRef.current);
            if (raw) {
                const parsed = JSON.parse(raw) as Persisted;
                if (parsed?.v === STORAGE_VERSION) {
                    if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
                    if (Array.isArray(parsed.importedLeadIds)) setImportedLeadIds(parsed.importedLeadIds);
                }
            }
        } catch { /* corrupt/blocked storage — start fresh */ }
        setHydrated(true);
    }, []);

    // Write-through backup. Guarded on `hydrated` so we never clobber stored state
    // with the empty initial state before the read above has run.
    useEffect(() => {
        if (!hydrated) return;
        try {
            const payload: Persisted = {
                v: STORAGE_VERSION,
                messages: toDurableMessages(messages),
                importedLeadIds,
            };
            localStorage.setItem(keyRef.current || storageKey(), JSON.stringify(payload));
        } catch { /* quota/blocked — non-fatal, the in-memory thread still works */ }
    }, [messages, importedLeadIds, hydrated]);

    const reset = useCallback(() => {
        setMessages([]);
        setImportedLeadIds([]);
        try { localStorage.removeItem(keyRef.current || storageKey()); } catch { /* ignore */ }
    }, []);

    const value = useMemo<CopilotState>(
        () => ({ messages, setMessages, importedLeadIds, setImportedLeadIds, hydrated, reset }),
        [messages, importedLeadIds, hydrated, reset],
    );

    return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot(): CopilotState {
    const ctx = useContext(CopilotContext);
    if (!ctx) throw new Error('useCopilot must be used within a CopilotProvider');
    return ctx;
}
