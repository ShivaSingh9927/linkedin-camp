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
    generateActivationTemplatePicks,
    generateSearchQuery,
    routeCopilotMessage,
    type ActivationGrounding,
} from '../campaign-engine/ai-service';
import { TEMPLATES, type TemplateDefinition } from '../campaign-templates';
import { checkSearchQuota } from '../campaign-engine/safety/quota';
import { checkQuota } from '../campaign-engine/safety/quota';
import { renderCapabilityContract, COPILOT_INTENTS, type CopilotContext, type CopilotIntent } from '../copilot/capabilities';
import { runIntentQuery, getAudienceSummary, findLeadByName, type QueryToolData, type AudienceSummaryData, type LeadMatch } from '../copilot/query-tools';

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

// Keep individual grounding lines short so the profile snapshot stays a fixed,
// small size regardless of how verbose a field is.
function clamp(s?: string, max = 160): string | undefined {
    if (!s) return undefined;
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// Distill the full grounding into the 4-line snapshot the chat contract renders.
// Never the raw rows — just enough for the bot to sound like it knows the user.
function distillProfile(g: ActivationGrounding) {
    return {
        youAre: clamp([g.senderName, g.selfHeadline].filter(Boolean).join(' — ')) || undefined,
        youSell: clamp([g.company, g.companyDescription || g.products || g.valueProp].filter(Boolean).join(': ')) || undefined,
        bestFitBuyer: clamp(g.targetAudience || g.persona || g.industry),
        goal: clamp(g.goalType),
    };
}

// The profile counts as "made" once any substantive field is present. Below this
// the copilot flags it and nudges the user to finish their AI profile.
function isProfileComplete(g: ActivationGrounding): boolean {
    return !!(g.company || g.companyDescription || g.products || g.valueProp || g.targetAudience || g.aiStrategy);
}

// Compose the authoritative "here's where things stand" line from the read-only
// tools. The model writes the warm intro; THIS provides the numbers, so status
// answers are always exact (the model never invents figures).
function statusFacts(td: QueryToolData, ctx: CopilotContext): string {
    const parts: string[] = [];
    if (td.campaign) {
        const c = td.campaign;
        parts.push(`Your campaign “${c.name}” is ${c.pct}% done — ${c.processed}/${c.total} leads processed, ${c.connected} connected, ${c.replied} replied.`);
    } else if (td.lastCompleted && td.lastCompleted.total > 0) {
        // Retrospective on the most recent finished campaign, with a light judgment.
        const c = td.lastCompleted;
        const connectPct = c.total ? Math.round((c.connected / c.total) * 100) : 0;
        const assess = connectPct >= 30
            ? 'Solid connect rate.'
            : 'Connect rate is on the low side — a tighter ICP or a warmer invite note could lift it.';
        parts.push(`No campaign running now. Your last one, “${c.name}”, finished: ${c.total} leads, ${c.connected} connected (${connectPct}%), ${c.replied} replied. ${assess}`);
    } else {
        parts.push('No campaign is running right now.');
    }
    if (td.repliesWaiting && td.repliesWaiting.count > 0) {
        const n = td.repliesWaiting.count;
        const who = td.repliesWaiting.names.slice(0, 2).filter(Boolean).join(', ');
        parts.push(`${n} conversation${n === 1 ? '' : 's'} awaiting your reply${who ? ` (e.g. ${who})` : ''}.`);
    }
    parts.push(`Searches left this month: ${ctx.searchesRemaining}/${ctx.searchesCap}. Invites left today: ${ctx.dailyConnectRemaining}.`);
    return parts.join(' ');
}

// Answer a "look up X in my leads" request from the user's OWN imported leads.
function leadLookupReply(query: string, matches: LeadMatch[]): string {
    if (!matches.length) {
        return `I couldn’t find a lead matching “${query}” in your list. I can only look up leads you’ve already imported — want me to search LinkedIn for them instead?`;
    }
    if (matches.length === 1) {
        const m = matches[0];
        const role = [m.jobTitle, m.company].filter(Boolean).join(' at ');
        const head = [m.name, role].filter(Boolean).join(' — ');
        return `${head}${m.location ? ` (${m.location})` : ''}. Status: ${m.status}.${m.linkedinUrl ? `\n${m.linkedinUrl}` : ''}`;
    }
    const lines = matches.map((m) => `• ${m.name}${m.company ? ` — ${m.company}` : ''}${m.linkedinUrl ? ` — ${m.linkedinUrl}` : ''}`);
    return `I found ${matches.length} matching leads:\n${lines.join('\n')}`;
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

// Copilot free-text router. Gathers the user's live account state, renders the
// capability contract from the manifest, and asks the ai-service to classify the
// message into ONE allowed intent + a reply. Does NOT execute — the frontend
// runs the proposed action through the already-guarded endpoints, which re-check
// every limit. So even a jailbroken classification can't exceed the rules.
export const copilotMessage = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { message, history, importedThisSession } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message_required' });
    }

    try {
        // All fetched fresh per message and summarized into a fixed-size snapshot
        // (counts + a distilled profile) — never raw rows. grounding is one indexed
        // lookup by userId; it's what finally gives the CHAT (not just the opening
        // cards) knowledge of who the user is.
        const [activeCampaignCount, leadCount, searchQ, connectQ, msgQ, user, grounding] = await Promise.all([
            prisma.campaign.count({ where: { userId, status: 'ACTIVE' } }).catch(() => 0),
            prisma.lead.count({ where: { userId } }).catch(() => 0),
            checkSearchQuota(userId),
            checkQuota(userId, 'connect'),
            checkQuota(userId, 'send-message'),
            prisma.user.findUnique({ where: { id: userId }, select: { linkedinCookie: true } }).catch(() => null),
            loadGrounding(userId).catch(() => ({} as ActivationGrounding)),
        ]);

        const ctx: CopilotContext = {
            linkedinConnected: !!user?.linkedinCookie,
            activeCampaignCount,
            leadCount,
            importedThisSession: typeof importedThisSession === 'number' ? importedThisSession : 0,
            searchesRemaining: searchQ.remaining,
            searchesCap: searchQ.cap,
            dailyConnectRemaining: connectQ.remaining,
            dailyMessageRemaining: msgQ.remaining,
            profileComplete: isProfileComplete(grounding),
            profile: distillProfile(grounding),
        };

        const routed = await routeCopilotMessage({
            message: message.trim(),
            systemContext: renderCapabilityContract(ctx),
            allowedIntents: COPILOT_INTENTS,
            history: Array.isArray(history) ? history : undefined,
        });

        // Safety net: never let an unknown intent through even if the model/ai
        // layer misbehaves — coerce to off_topic.
        const intent = ((COPILOT_INTENTS as string[]).includes(routed.intent) ? routed.intent : 'off_topic') as CopilotIntent;

        // Deterministic read-only pre-fetch (Option B): run the query the intent
        // needs, then ground the reply in the result. No second LLM call.
        let toolData = await runIntentQuery(intent, userId).catch(() => null);

        let reply = routed.reply;
        if (intent === 'check_status' && toolData) {
            const facts = statusFacts(toolData, ctx);
            reply = [reply, facts].filter(Boolean).join('\n\n');
        }
        // lookup_lead: read the person straight from the user's own lead list
        // (never a LinkedIn search) and answer with their real fields.
        if (intent === 'lookup_lead') {
            const q = (routed.params?.keywords || message).trim();
            const matches = await findLeadByName(userId, q).catch(() => [] as LeadMatch[]);
            reply = leadLookupReply(q, matches);
            toolData = { ...(toolData || {}), leads: matches };
        }
        // find_leads: don't search yet — REASON a strong boolean query from the
        // phrase + profile + audience and hand it back for the user to approve/edit
        // (searches are budget-scarce, so we show before we spend).
        if (intent === 'find_leads') {
            const phrase = (routed.params?.keywords || message).trim();
            const audienceStr = toolData?.audience ? formatAudience(toolData.audience) : '';
            try {
                const draft = await generateSearchQuery(phrase, grounding, audienceStr);
                toolData = { ...(toolData || {}), searchDraft: { label: draft.label, keywords: draft.keywords, filters: draft.filters, rationale: draft.rationale } };
            } catch { /* frontend falls back to searching the raw phrase */ }
        }

        res.json({
            intent,
            params: routed.params,
            reply,
            needsConfirm: intent === 'launch_campaign' && routed.needsConfirm,
            // Structured tool results for the client to render richer cards later
            // (status, audience). Null when the intent needs no live lookup.
            toolData,
            context: {
                activeCampaignCount,
                leadCount,
                searchesRemaining: searchQ.remaining,
                searchesCap: searchQ.cap,
                linkedinConnected: ctx.linkedinConnected,
                profileComplete: ctx.profileComplete,
            },
        });
    } catch (error: any) {
        console.error('[COPILOT] message error:', error.message);
        res.status(502).json({ error: 'copilot_failed', message: 'I had trouble processing that — try again in a moment.' });
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

// Compact one-line summary of the imported audience for the LLM — top roles /
// companies / warmth. Empty string when nothing's imported yet.
function formatAudience(a: AudienceSummaryData): string {
    if (!a || !a.total) return '';
    const roles = a.topTitles.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(', ');
    const companies = a.topCompanies.slice(0, 3).map((c) => `${c.value} (${c.count})`).join(', ');
    const cold = (a.byStatus['IMPORTED'] || 0) + (a.byStatus['PENDING'] || 0);
    const warm = (a.byStatus['CONNECTED'] || 0) + (a.byStatus['REPLIED'] || 0);
    const parts = [`${a.total} leads imported (${warm} connected/replied, ${cold} not yet contacted)`];
    if (roles) parts.push(`top roles: ${roles}`);
    if (companies) parts.push(`top companies: ${companies}`);
    return parts.join('; ');
}

export const activationRecommendTemplates = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const grounding = await loadGrounding(userId);
        const goalType = grounding.goalType || 'sell';
        const icp = GOAL_TO_ICP[goalType] || 'universal';

        // Candidates: goal-matched + universal starter campaigns.
        const matched = TEMPLATES.filter((t) => isStarterCampaign(t) && t.icp === icp);
        const universal = TEMPLATES.filter((t) => isStarterCampaign(t) && t.icp === 'universal' && icp !== 'universal');

        // Heuristic rank narrows the catalog: cold (out-of-network) first, then
        // goal-icp fit, then simplicity. Top ~8 become the LLM's candidate set.
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

        const needsEmailOf = (t: TemplateDefinition) => (t.requires || []).includes('email-finder') || (t.requires || []).includes('email');
        const buildPick = (t: TemplateDefinition, why?: string) => ({
            templateId: t.id,
            label: t.name,
            why: why || t.bestFor || t.useCase,
            icon: t.icon,
            stepCount: t.stepCount,
            durationDays: t.durationDays,
            needsEmail: needsEmailOf(t),
        });

        // Deterministic heuristic fallback (used if the LLM pick fails/empties).
        let picks = ranked.slice(0, 3).map((t) => buildPick(t));

        // Smart pick: the LLM chooses from the narrowed candidates, grounded on the
        // profile + the audience actually imported, with a tailored "why". Failure
        // is non-fatal — we keep the heuristic list.
        try {
            const candidates = ranked.slice(0, 8);
            const audience = await getAudienceSummary(userId).then(formatAudience).catch(() => '');
            const { picks: llmPicks } = await generateActivationTemplatePicks(
                grounding,
                audience,
                candidates.map((t) => ({ id: t.id, name: t.name, bestFor: t.bestFor || t.useCase, audience: t.audience, needsEmail: needsEmailOf(t) })),
            );
            const byId = new Map(candidates.map((t) => [t.id, t] as const));
            const smart = llmPicks
                .map((p) => { const t = byId.get(p.templateId); return t ? buildPick(t, p.why) : null; })
                .filter((x): x is ReturnType<typeof buildPick> => x !== null);
            if (smart.length) picks = smart;
        } catch (e: any) {
            console.warn('[ACTIVATION] smart template pick failed, using heuristic:', e?.message);
        }

        res.json({ picks, coldStart, goalType });
    } catch (error: any) {
        console.error('[ACTIVATION] recommend-templates error:', error.message);
        res.status(500).json({ error: 'Failed to recommend templates' });
    }
};
