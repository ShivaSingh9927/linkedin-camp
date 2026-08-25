// Shared conversation types for the activation copilot. Extracted so both the
// CopilotProvider (state + persistence) and CopilotConversation (rendering) can
// import the Msg union without a circular dependency.

import type { Understand, SearchRecommendation, SearchFilters, SearchPerson, TemplatePick } from './copilotApi';

export type Msg =
    | { id: string; role: 'qampi' | 'user'; kind: 'text'; text: string }
    | { id: string; role: 'qampi'; kind: 'understand'; loading: boolean; data?: Understand }
    | { id: string; role: 'qampi'; kind: 'searchChips'; loading: boolean; recs?: SearchRecommendation[] }
    // A reasoned query shown BEFORE a search is spent — the user approves/edits it.
    | { id: string; role: 'qampi'; kind: 'searchDraft'; label: string; keywords: string; filters?: SearchFilters; rationale?: string }
    | { id: string; role: 'qampi'; kind: 'searching'; label: string }
    | { id: string; role: 'qampi'; kind: 'results'; people: SearchPerson[]; via: string; remaining: number; cap: number; keywords: string; filters?: SearchFilters; page: number }
    | { id: string; role: 'qampi'; kind: 'templates'; loading: boolean; picks?: TemplatePick[] }
    | { id: string; role: 'qampi'; kind: 'launchConfirm'; templateId: string; label: string; leadIds: string[]; note?: string; setup?: { objective: string; cta: string; tone: string }; meta?: { durationDays: number; stepCount: number; needsEmail: boolean }; state: 'idle' | 'launching' | 'done' | 'error'; campaignId?: string; error?: string }
    | { id: string; role: 'qampi'; kind: 'reconnect' };

export type MsgKind = Msg['kind'];

let _id = 0;
export const nextId = () => `m${Date.now()}_${_id++}`;

// Message kinds that are safe to persist and restore verbatim. Volatile kinds
// (live search results, suggestion chips, in-flight spinners) are dropped on
// save — the narrative text stays, but live data is always re-fetched fresh
// rather than replayed from a stale snapshot.
const DURABLE_KINDS: ReadonlySet<MsgKind> = new Set<MsgKind>(['text', 'understand', 'reconnect', 'launchConfirm']);

const MAX_PERSISTED = 40;

// Reduce a live transcript to the subset worth restoring after a reload.
export function toDurableMessages(messages: Msg[]): Msg[] {
    const durable = messages.filter((m) => {
        if (!DURABLE_KINDS.has(m.kind)) return false;
        // Only keep an understand card once it has resolved (never a spinner).
        if (m.kind === 'understand') return !m.loading && !!m.data;
        // Only keep a launch card in its terminal "done" state (a completed launch
        // is history; an idle/launching/error card shouldn't resurrect as clickable).
        if (m.kind === 'launchConfirm') return m.state === 'done';
        return true;
    });
    return durable.slice(-MAX_PERSISTED);
}
