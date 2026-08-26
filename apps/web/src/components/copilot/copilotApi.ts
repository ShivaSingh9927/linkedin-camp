// Thin client for the activation copilot. Wraps the shared axios `api` (Bearer +
// 401 handling already built in) so the conversation component stays declarative.

import api from '@/lib/api';

export interface Understand {
    youAre: string;
    yourGoal: string;
    bestFitBuyer: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface SearchFilters {
    title?: string;
    location?: string;
    industry?: string;
    degree?: string; // 'any' | '2nd' | '3rd'
}

export interface SearchRecommendation {
    label: string;
    keywords: string;
    filters: SearchFilters;
    rationale: string;
}

export interface SearchPerson {
    firstName: string;
    lastName: string;
    name: string;
    headline: string;
    jobTitle: string;
    company: string;
    location: string;
    connectionDegree: 1 | 2 | 3 | null;
    linkedinUrl: string;
}

export interface SaturationSignal {
    state: 'active' | 'saturating' | 'exhausted';
    newRatio: number;
    page: number;
    freshCount: number;
    pageCount: number;
}

export interface SearchResponse {
    people: SearchPerson[];
    via: 'browserless' | 'dom';
    remaining: number;
    cap: number;
    saturation?: SaturationSignal;
}

export interface TemplatePick {
    templateId: string;
    label: string;
    why: string;
    icon: string;
    stepCount: number;
    durationDays: number;
    needsEmail: boolean;
}

export interface TemplatesResponse {
    picks: TemplatePick[];
    coldStart: boolean;
    goalType: string;
}

export async function fetchUnderstand(): Promise<Understand> {
    const { data } = await api.post('/ai/activation/understand', {});
    return data;
}

export async function fetchSearchRecommendations(): Promise<SearchRecommendation[]> {
    const { data } = await api.post('/ai/activation/recommend-search', {});
    return data?.recommendations || [];
}

// degree string ('2nd'/'3rd'/'any') → the numeric degrees the search API expects.
function degreeToNumbers(degree?: string): Array<1 | 2 | 3> | undefined {
    if (!degree || degree === 'any') return undefined;
    if (degree.startsWith('2')) return [2];
    if (degree.startsWith('3')) return [3];
    if (degree.startsWith('1')) return [1];
    return undefined;
}

export async function runSearch(keywords: string, filters?: SearchFilters, page?: number, label?: string): Promise<SearchResponse> {
    const degrees = degreeToNumbers(filters?.degree);
    const { data } = await api.post('/leads/search', {
        keywords,
        filters: filters
            ? { title: filters.title, location: filters.location, industry: filters.industry, ...(degrees ? { degrees } : {}) }
            : undefined,
        ...(page && page > 1 ? { page } : {}),
        ...(label ? { label } : {}),
    });
    return data;
}

export async function importPeople(people: SearchPerson[]): Promise<{ importedTotal: number; duplicatesSkipped: number; leadIds: string[] }> {
    const leads = people.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        jobTitle: p.jobTitle,
        company: p.company,
        location: p.location,
        connectionDegree: p.connectionDegree,
        linkedinUrl: p.linkedinUrl,
        info: p.headline,
    }));
    const { data } = await api.post('/leads/import', { leads });
    return { importedTotal: data?.importedTotal || 0, duplicatesSkipped: data?.duplicatesSkipped || 0, leadIds: data?.leadIds || [] };
}

export async function fetchTemplateRecommendations(): Promise<TemplatesResponse> {
    const { data } = await api.post('/ai/activation/recommend-templates', {});
    return data;
}

// Leads already in the user's account that aren't in any campaign yet — the pool
// a chat launch can fall back to when this session imported nothing (e.g. after
// a reload). The server caps the count; the launch path enforces the lead cap.
export async function fetchAvailableLeads(): Promise<{ count: number; leadIds: string[] }> {
    const { data } = await api.get('/leads/available');
    return { count: data?.count || 0, leadIds: data?.leadIds || [] };
}

// Real state for a proactive opening line — so a fresh thread greets the user
// with what actually needs attention (active campaign + replies waiting), never
// a hollow "how can I help". Reuses existing endpoints; fails soft to a plain hi.
export interface ProactiveContext {
    firstName: string;
    campaign: { name: string; processed: number; total: number } | null;
    repliesWaiting: number;
}

export async function fetchProactiveContext(): Promise<ProactiveContext> {
    let firstName = '';
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); firstName = (u?.name || '').split(/\s+/)[0] || ''; } catch { /* ignore */ }
    const [statsRes, followRes] = await Promise.allSettled([api.get('/stats'), api.get('/leads/follow-ups')]);
    let campaign: ProactiveContext['campaign'] = null;
    if (statsRes.status === 'fulfilled') {
        const cps = (statsRes.value.data?.campaignPerformance || []) as Array<{ status?: string; name?: string; totalLeads?: number; pending?: number }>;
        const a = cps.find((c) => c.status === 'ACTIVE');
        if (a) campaign = { name: a.name || 'your campaign', processed: Math.max(0, (a.totalLeads || 0) - (a.pending || 0)), total: a.totalLeads || 0 };
    }
    let repliesWaiting = 0;
    if (followRes.status === 'fulfilled') repliesWaiting = followRes.value.data?.counts?.replied || 0;
    return { firstName, campaign, repliesWaiting };
}

// ---- intent router ----

export type CopilotIntent =
    | 'find_leads' | 'recommend_campaign' | 'launch_campaign'
    | 'check_status' | 'explain' | 'unsupported' | 'off_topic';

// A lead whose latest message is inbound (they replied, awaiting the user).
export interface WaitingReply {
    leadId: string;
    name: string;
    subtitle: string;
    message: string;
    at: string;
}

// Structured tool results the backend pre-fetched for this intent. searchDraft =
// the reasoned query to show before a search is spent; waitingReplies = the
// unanswered conversations to draft in-chat.
export interface RoutedToolData {
    searchDraft?: SearchRecommendation;
    waitingReplies?: WaitingReply[];
}

export interface RoutedMessage {
    intent: CopilotIntent | 'lookup_lead' | 'handle_replies';
    params: { keywords: string; templateId: string };
    reply: string;
    needsConfirm: boolean;
    toolData?: RoutedToolData | null;
}

// Draft a reply to one lead (loads their thread server-side). `tone` → warmer
// takes on "Try warmer". Rationale is the model's recommended-next line.
export interface ReplyDraftResult { text: string; rationale: string }
export async function draftReply(leadId: string, tone?: string): Promise<ReplyDraftResult> {
    const { data } = await api.post('/ai/copilot/draft-reply', { leadId, ...(tone ? { tone } : {}) });
    return { text: data?.text || '', rationale: data?.rationale || '' };
}

// Queue a human-authored reply on the guarded inbox send path (Qampi never
// auto-sends — this only fires from an explicit Send click).
export async function sendReply(leadId: string, content: string): Promise<void> {
    await api.post(`/inbox/conversations/${encodeURIComponent(leadId)}/messages`, { content });
}

export interface HistoryMsg { sender: 'you' | 'qampi'; text: string }

export async function routeMessage(message: string, history: HistoryMsg[], importedThisSession: number): Promise<RoutedMessage> {
    const { data } = await api.post('/ai/copilot/message', { message, history, importedThisSession });
    return data as RoutedMessage;
}

// ---- one-click launch (reuses the existing guarded endpoints) ----

export type LaunchResult =
    | { ok: true; campaignId: string; templateName: string }
    | { ok: false; reason: 'active_exists' | 'lead_cap' | 'no_leads' | 'error'; message: string };

// The template's default AI strategy — used to PREFILL the launch-setup step so
// the user confirms/tweaks real values rather than a blank form.
export interface TemplateHint {
    name: string;
    objective: string;
    cta: string;
    tone: string;
    durationDays: number;
    stepCount: number;
    needsEmail: boolean;
}

export async function fetchTemplateHint(templateId: string): Promise<TemplateHint> {
    const { data } = await api.get(`/templates/${encodeURIComponent(templateId)}`);
    const t = data?.template;
    const hint = t?.aiStrategyHint || {};
    const requires: string[] = t?.requires || [];
    return {
        name: t?.name || '',
        objective: hint.objective || '',
        cta: hint.cta || '',
        tone: hint.toneOverride || 'professional',
        durationDays: t?.durationDays || 0,
        stepCount: t?.stepCount || 0,
        needsEmail: requires.includes('email-finder') || requires.includes('email'),
    };
}

export interface LaunchOverrides { objective?: string; cta?: string; toneOverride?: string }

export async function launchFromTemplate(templateId: string, leadIds: string[], overrides?: LaunchOverrides): Promise<LaunchResult> {
    if (!leadIds.length) {
        return { ok: false, reason: 'no_leads', message: 'Import some leads first, then I can launch a campaign on them.' };
    }
    try {
        const { data: tpl } = await api.get(`/templates/${encodeURIComponent(templateId)}`);
        const t = tpl?.template;
        if (!t) return { ok: false, reason: 'error', message: 'That template no longer exists.' };
        const hint = t.aiStrategyHint || {};
        // The user's edited campaign-level inputs win over the template defaults;
        // description stays templated (not user-edited in the chat flow).
        const { data: campaign } = await api.post('/campaigns', {
            name: t.name,
            workflow: t.workflow,
            objective: overrides?.objective ?? hint.objective,
            description: hint.description,
            cta: overrides?.cta ?? hint.cta,
            toneOverride: overrides?.toneOverride ?? hint.toneOverride,
            leads: leadIds,
        });
        // Guarded launch — startCampaign enforces the 1-active rule + lead cap.
        await api.post(`/campaigns/${campaign.id}/start`, { leadIds });
        return { ok: true, campaignId: campaign.id, templateName: t.name };
    } catch (e) {
        const err = e as { response?: { status?: number; data?: { error?: string; message?: string } } };
        const code = err?.response?.data?.error;
        const msg = err?.response?.data?.message || '';
        if (code === 'ACTIVE_CAMPAIGN_EXISTS') return { ok: false, reason: 'active_exists', message: msg || 'You already have an active campaign. Pause it or wait for it to finish before starting another.' };
        if (code === 'LEAD_CAP_EXCEEDED') return { ok: false, reason: 'lead_cap', message: msg || 'That is more leads than your plan allows for one campaign.' };
        return { ok: false, reason: 'error', message: 'Could not launch the campaign right now. Try again in a moment.' };
    }
}
