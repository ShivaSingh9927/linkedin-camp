// activation.controller.ts
//
// The Qampi activation copilot's brain. Three endpoints power the signin→first-
// campaign conversation:
//   • understand         → "here's how I understand you" card
//   • recommend-search   → 2-3 LinkedIn people-searches to offer as chips
//   • recommend-templates→ 2-3 simple campaign templates matched to the goal
//
// understand + recommend-search delegate to the ai-service (grounded on the
// user's businessProfile + connected-LinkedIn self-* fields). recommend-templates
// is backend-local — the template catalog lives here, so we filter it directly
// (no LLM, instant) and fall back to a simple safe sequence for cold starts.

import { Response } from 'express';
import { prisma } from '@repo/db';
import { AuthRequest } from '../middleware/auth.middleware';
import {
    generateActivationUnderstand,
    generateActivationSearchRecs,
    type ActivationGrounding,
} from '../campaign-engine/ai-service';
import { TEMPLATES, type TemplateDefinition } from '../campaign-templates';

// Build the grounding object from the user's businessProfile. Both self-* fields
// (read from their real LinkedIn after connect) and the onboarding-provided
// fields feed the AI — self-* is the higher-signal source when present.
async function loadGrounding(userId: string): Promise<ActivationGrounding> {
    const bp = await prisma.businessProfile.findUnique({ where: { userId } }).catch(() => null);
    return {
        goalType: bp?.goalType || undefined,
        senderName: bp?.name || undefined,
        selfHeadline: bp?.selfHeadline || undefined,
        selfAbout: bp?.selfAbout || undefined,
        selfIndustry: bp?.selfIndustry || undefined,
        selfLocation: bp?.selfGeoLocation || undefined,
        company: bp?.company || undefined,
        companyDescription: bp?.companyDescription || undefined,
        products: bp?.products || undefined,
        differentiators: bp?.differentiators || undefined,
        targetAudience: bp?.targetAudience || undefined,
        industry: bp?.industry || undefined,
        mainPainPoint: bp?.mainPainPoint || undefined,
        valueProp: bp?.valueProp || undefined,
        persona: bp?.persona || undefined,
        aiStrategy: bp?.aiStrategy || undefined,
    };
}

export const activationUnderstand = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const grounding = await loadGrounding(userId);
        const result = await generateActivationUnderstand(grounding);
        res.json(result);
    } catch (error: any) {
        console.error('[ACTIVATION] understand error:', error.message);
        res.status(502).json({ error: 'Failed to build your profile summary' });
    }
};

export const activationRecommendSearch = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const grounding = await loadGrounding(userId);
        const result = await generateActivationSearchRecs(grounding);
        res.json(result);
    } catch (error: any) {
        console.error('[ACTIVATION] recommend-search error:', error.message);
        res.status(502).json({ error: 'Failed to recommend searches' });
    }
};

// goalType (onboarding) → template icp tag.
const GOAL_TO_ICP: Record<string, TemplateDefinition['icp']> = {
    sell: 'sales',
    recruiting: 'recruiter',
    job_seeking: 'job-seeker',
    fundraising: 'founder',
    networking: 'universal',
};

// A "first campaign" must be an actual outreach SEQUENCE, not a utility. Only
// the two starter groups qualify: 'out-of-network' (cold: connect→message→…) and
// 'my-network' (warm outreach to existing connections). 'objective-based'
// (enrichment / inbox-sync utilities) and 'action-triggered' (reactive) are
// excluded, as are follow-up templates (they need an existing campaign to chain).
const STARTER_GROUPS = new Set(['out-of-network', 'my-network']);
function isStarterCampaign(t: TemplateDefinition): boolean {
    if (!STARTER_GROUPS.has(t.group)) return false;
    if (t.id.startsWith('followup')) return false;
    return true;
}

// "Simple" = easy to launch first: no email-finder requirement, then fewest
// steps. Keeps the first recommendation approachable (connect→visit→message-ish).
function simplicityScore(t: TemplateDefinition): number {
    const needsEmail = (t.requires || []).includes('email-finder') || (t.requires || []).includes('email');
    return (needsEmail ? 100 : 0) + t.stepCount;
}

export const activationRecommendTemplates = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const bp = await prisma.businessProfile.findUnique({
            where: { userId },
            select: { goalType: true },
        }).catch(() => null);
        const goalType = bp?.goalType || 'sell';
        const icp = GOAL_TO_ICP[goalType] || 'universal';

        // Candidates: goal-matched + universal starter campaigns.
        const matched = TEMPLATES.filter((t) => isStarterCampaign(t) && t.icp === icp);
        const universal = TEMPLATES.filter((t) => isStarterCampaign(t) && t.icp === 'universal' && icp !== 'universal');

        // Rank for the leads-first flow: the user is about to run this on COLD
        // leads they just searched, so cold (out-of-network) sequences match best;
        // then goal-icp fit; then simplicity (approachable first campaign).
        const ranked = [...matched, ...universal].sort((a, b) => {
            const coldA = a.group === 'out-of-network' ? 0 : 1;
            const coldB = b.group === 'out-of-network' ? 0 : 1;
            if (coldA !== coldB) return coldA - coldB;
            const icpA = a.icp === icp ? 0 : 1;
            const icpB = b.icp === icp ? 0 : 1;
            if (icpA !== icpB) return icpA - icpB;
            return simplicityScore(a) - simplicityScore(b);
        });

        // Cold start: no goal-matched starter (thin/unknown goal) — we lean on the
        // simple universal set, which is the safe connect→visit→message shape.
        const coldStart = matched.length === 0;

        const picks = ranked.slice(0, 3).map((t) => ({
            templateId: t.id,
            label: t.name,
            why: t.bestFor || t.useCase,
            icon: t.icon,
            stepCount: t.stepCount,
            durationDays: t.durationDays,
            needsEmail: (t.requires || []).includes('email-finder') || (t.requires || []).includes('email'),
        }));

        res.json({ picks, coldStart, goalType });
    } catch (error: any) {
        console.error('[ACTIVATION] recommend-templates error:', error.message);
        res.status(500).json({ error: 'Failed to recommend templates' });
    }
};
