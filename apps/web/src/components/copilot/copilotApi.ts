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

export interface SearchResponse {
    people: SearchPerson[];
    via: 'browserless' | 'dom';
    remaining: number;
    cap: number;
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

export async function runSearch(keywords: string, filters?: SearchFilters): Promise<SearchResponse> {
    const degrees = degreeToNumbers(filters?.degree);
    const { data } = await api.post('/leads/search', {
        keywords,
        filters: filters
            ? { title: filters.title, location: filters.location, industry: filters.industry, ...(degrees ? { degrees } : {}) }
            : undefined,
    });
    return data;
}

export async function importPeople(people: SearchPerson[]): Promise<{ importedTotal: number; duplicatesSkipped: number }> {
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
    return { importedTotal: data?.importedTotal || 0, duplicatesSkipped: data?.duplicatesSkipped || 0 };
}

export async function fetchTemplateRecommendations(): Promise<TemplatesResponse> {
    const { data } = await api.post('/ai/activation/recommend-templates', {});
    return data;
}
