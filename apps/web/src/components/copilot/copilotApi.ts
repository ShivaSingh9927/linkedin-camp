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

// ---- intent router ----

export type CopilotIntent =
    | 'find_leads' | 'recommend_campaign' | 'launch_campaign'
    | 'check_status' | 'explain' | 'unsupported' | 'off_topic';

// Structured tool results the backend pre-fetched for this intent. Only
// searchDraft is consumed by the UI today (the reasoned query to show before a
// search is spent); other tool outputs currently arrive folded into `reply`.
export interface RoutedToolData {
    searchDraft?: SearchRecommendation;
}

export interface RoutedMessage {
    intent: CopilotIntent | 'lookup_lead';
    params: { keywords: string; templateId: string };
    reply: string;
    needsConfirm: boolean;
    toolData?: RoutedToolData | null;
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
