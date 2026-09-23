// Shared conversation types for the activation copilot. Extracted so both the
// CopilotProvider (state + persistence) and CopilotConversation (rendering) can
// import the Msg union without a circular dependency.

import type { Understand, SearchRecommendation, SearchFilters, SearchPerson, TemplatePick, SaturationSignal } from './copilotApi';

export type Msg =
    | { id: string; role: 'qampi' | 'user'; kind: 'text'; text: string }
    | { id: string; role: 'qampi'; kind: 'understand'; loading: boolean; data?: Understand }
    | { id: string; role: 'qampi'; kind: 'searchChips'; loading: boolean; recs?: SearchRecommendation[] }
    // A reasoned query shown BEFORE a search is spent — the user approves/edits it.
    | { id: string; role: 'qampi'; kind: 'searchDraft'; label: string; keywords: string; filters?: SearchFilters; rationale?: string; reasoning?: string }
    // User-facing progress only — concise task/rationale, never private model reasoning.
    // The doubt layer: one question the copilot needs answered before it can act,
    // offered as tappable options rather than prose the user has to answer by
    // typing. `answered` freezes the card once used so the thread stays honest
    // about what was chosen.
    | { id: string; role: 'qampi'; kind: 'clarify'; question: string; options: string[]; multi: boolean; forMessage: string; answered?: string }
    | { id: string; role: 'qampi'; kind: 'searching'; label: string; detail?: string }
    | { id: string; role: 'qampi'; kind: 'webSearch'; query: string; state: 'install' | 'permission' | 'ready' | 'searching' | 'error'; error?: string }
    // Grounded public-web research is a brief, not an unstructured chat wall.
    // Sources remain distinct from the answer so they can be inspected on demand.
    | { id: string; role: 'qampi'; kind: 'researchBrief'; query: string; reply: string; sources: Array<{ title: string; url: string }> }
    | { id: string; role: 'qampi'; kind: 'results'; people: SearchPerson[]; via: string; remaining: number; cap: number; keywords: string; filters?: SearchFilters; page: number; saturation?: SaturationSignal }
    | { id: string; role: 'qampi'; kind: 'templates'; loading: boolean; picks?: TemplatePick[] }
    | { id: string; role: 'qampi'; kind: 'launchConfirm'; templateId: string; label: string; leadIds: string[]; note?: string; setup?: { objective: string; cta: string; tone: string }; meta?: { durationDays: number; stepCount: number; needsEmail: boolean }; state: 'idle' | 'launching' | 'done' | 'error'; campaignId?: string; error?: string }
    // An in-chat reply card: their message + a Qampi draft the user reviews/sends.
    | { id: string; role: 'qampi'; kind: 'replyDraft'; leadId: string; name: string; subtitle: string; theirMessage: string; draft: string; initialDraft?: string; harnessTurnId?: string; editedRecorded?: boolean; rationale: string; tone: string; remaining: number; state: 'drafting' | 'ready' | 'sending' | 'sent' | 'error'; error?: string }
    | { id: string; role: 'qampi'; kind: 'reconnect' };

export type MsgKind = Msg['kind'];

let _id = 0;
export const nextId = () => `m${Date.now()}_${_id++}`;

// V2 stored completed web research as a normal assistant text message with a
// long `Sources:` tail. Upgrade those saved messages while hydrating so users
// immediately get the research-brief treatment after the frontend deploy,
// without having to repeat their question or delete a thread.
export function upgradePersistedMessages(messages: Msg[]): Msg[] {
    let lastUserQuestion = '';
    return messages.map((message) => {
        if (message.kind === 'text' && message.role === 'user') {
            lastUserQuestion = message.text;
            return message;
        }
        if (message.kind !== 'text' || message.role !== 'qampi' || !/\n\s*Sources:\s*/i.test(message.text)) return message;

        const [reply, sourceTail = ''] = message.text.split(/\n\s*Sources:\s*/i, 2);
        const seen = new Set<string>();
        const sources = Array.from(sourceTail.matchAll(/https?:\/\/[^\s)\]]+/g))
            .map((match) => match[0].replace(/[.,;:]+$/, ''))
            .filter((url) => {
                if (seen.has(url)) return false;
                seen.add(url);
                return true;
            })
            .map((url) => {
                let title = url;
                try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { /* retain URL */ }
                return { title, url };
            });

        return {
            id: message.id,
            role: 'qampi',
            kind: 'researchBrief',
            query: lastUserQuestion || 'Web research',
            reply: reply.trim() || 'I found public sources for this research.',
            sources,
        };
    });
}

// Message kinds that are safe to persist and restore verbatim. Volatile kinds
// (live search results, suggestion chips, in-flight spinners) are dropped on
// save — the narrative text stays, but live data is always re-fetched fresh
// rather than replayed from a stale snapshot.
const DURABLE_KINDS: ReadonlySet<MsgKind> = new Set<MsgKind>(['text', 'understand', 'researchBrief', 'reconnect', 'launchConfirm']);

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
