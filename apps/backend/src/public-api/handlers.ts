import { Response } from 'express';
import { prisma } from '@repo/db';
import { getTemplates, getTemplateById } from '../campaign-templates';
import { startCampaign } from '../controllers/campaign.controller';
import { searchPeople } from '../services/people-search.service';
import { findEmail } from '../services/email-finder.service';
import { planFor } from '../config/plans';
import {
    checkQuota, checkInviteQuota, checkSearchQuota, checkEmailFinderQuota,
    logSearchAction, logEmailFinderAction,
} from '../campaign-engine/safety/quota';
import {
    apiError, list, parsePaging, sendPrereq,
    checkLinkedInHealthy, checkEmailAccount,
    startOfTomorrowUTC, startOfNextMonthUTC,
} from './util';

// Does a workflow send email (an EMAIL node)? Gates the email-account prereq.
function workflowHasEmailSend(workflowJson: any): boolean {
    const nodes: any[] = Array.isArray(workflowJson?.nodes) ? workflowJson.nodes : [];
    return nodes.some((n) => String(n?.data?.subType || n?.subType || n?.type || '').toUpperCase() === 'EMAIL');
}

// Serialize Infinity (unlimited when enforcement is off) as null for JSON.
const fin = (n: number) => (n === Infinity ? null : n);

// ── Templates ────────────────────────────────────────────────────────────────
function shapeTemplate(t: any, detailed: boolean) {
    const requires: string[] = t.requires || [];
    const requiresEmailAccount = requires.includes('email');
    const requiresEmailCredits = requires.includes('email-finder');
    const channels = requiresEmailAccount || requiresEmailCredits ? ['linkedin', 'email'] : ['linkedin'];
    const hint = t.aiStrategyHint || {};
    const base: any = {
        id: t.id,
        name: t.name,
        description: t.description,
        channels,
        requiredTier: requiresEmailAccount || requiresEmailCredits ? 'BUSINESS' : 'PRO',
        requiresEmailAccount,
        requiresEmailCredits,
        durationDays: t.durationDays,
        steps: (t.workflow?.nodes ?? [])
            .filter((n: any) => n.subType !== 'START')
            .map((n: any) => n.subType),
    };
    if (detailed) {
        base.content = {
            objective: { required: false, default: hint.objective ?? null },
            tone: { required: false, default: hint.toneOverride ?? null },
            cta: { required: false, default: hint.cta ?? null },
            description: { required: false, default: hint.description ?? null },
        };
    }
    return base;
}

export function listTemplates(_req: any, res: Response) {
    const data = getTemplates().map((t) => shapeTemplate(t, false));
    return res.json({ data, total: data.length });
}

export function getTemplate(req: any, res: Response) {
    const t = getTemplateById(req.params.id);
    if (!t) return apiError(res, 404, 'NOT_FOUND', 'Template not found');
    return res.json({ template: shapeTemplate(t, true) });
}

// ── Leads ────────────────────────────────────────────────────────────────────
const LEAD_SELECT = {
    id: true, firstName: true, lastName: true, jobTitle: true, company: true,
    location: true, linkedinUrl: true, email: true, connectionDegree: true,
    status: true, createdAt: true,
} as const;

export async function listLeads(req: any, res: Response) {
    const userId = req.user.id;
    const { limit, offset } = parsePaging(req);
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const where: any = { userId, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
        prisma.lead.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' }, select: LEAD_SELECT }),
        prisma.lead.count({ where }),
    ]);
    return list(res, rows, total, limit, offset);
}

export async function createLeads(req: any, res: Response) {
    const userId = req.user.id;
    const items = Array.isArray(req.body?.leads) ? req.body.leads : [req.body];
    if (items.length === 0 || items.length > 100) {
        return apiError(res, 400, 'VALIDATION_ERROR', 'Provide 1–100 leads', { field: 'leads' });
    }
    const created: any[] = [];
    for (const it of items) {
        if (!it || (!it.firstName && !it.linkedinUrl)) continue; // need at least a name or URL
        const data = {
            userId,
            firstName: it.firstName || null,
            lastName: it.lastName || null,
            jobTitle: it.jobTitle || null,
            company: it.company || null,
            location: it.location || null,
            linkedinUrl: it.linkedinUrl || null,
            email: it.email || null,
            connectionDegree: it.connectionDegree ?? null,
        };
        try {
            const row = it.linkedinUrl
                ? await prisma.lead.upsert({
                    where: { userId_linkedinUrl: { userId, linkedinUrl: it.linkedinUrl } },
                    create: data,
                    update: {}, // don't clobber existing enrichment on re-push
                    select: LEAD_SELECT,
                })
                : await prisma.lead.create({ data, select: LEAD_SELECT });
            created.push(row);
        } catch { /* skip a bad row, keep going */ }
    }
    return res.status(201).json({ data: created, count: created.length });
}

export async function getLead(req: any, res: Response) {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: LEAD_SELECT });
    if (!lead) return apiError(res, 404, 'NOT_FOUND', 'Lead not found');
    return res.json({ lead });
}

export async function patchLead(req: any, res: Response) {
    const userId = req.user.id;
    const { id } = req.params;
    const owned = await prisma.lead.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) return apiError(res, 404, 'NOT_FOUND', 'Lead not found');

    // Status is engine-derived (single source of truth) — not writable here.
    if (Array.isArray(req.body?.tags)) {
        await prisma.leadTag.deleteMany({ where: { leadId: id } });
        const tags = req.body.tags.map((t: any) => String(t).trim()).filter(Boolean);
        if (tags.length) await prisma.leadTag.createMany({ data: tags.map((tag: string) => ({ leadId: id, tag })) });
    }
    if (typeof req.body?.info === 'string') {
        await prisma.lead.update({ where: { id }, data: { info: req.body.info } });
    }
    const lead = await prisma.lead.findFirst({ where: { id, userId }, select: LEAD_SELECT });
    return res.json({ lead });
}

// ── Campaigns ────────────────────────────────────────────────────────────────
export async function listCampaigns(req: any, res: Response) {
    const userId = req.user.id;
    const { limit, offset } = parsePaging(req);
    const [rows, total] = await Promise.all([
        prisma.campaign.findMany({
            where: { userId }, take: limit, skip: offset, orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, status: true, createdAt: true, _count: { select: { CampaignLead: true } } },
        }),
        prisma.campaign.count({ where: { userId } }),
    ]);
    const data = rows.map((c) => ({ id: c.id, name: c.name, status: c.status, createdAt: c.createdAt, leadCount: c._count.CampaignLead }));
    return list(res, data, total, limit, offset);
}

export async function getCampaign(req: any, res: Response) {
    const userId = req.user.id;
    const c = await prisma.campaign.findFirst({
        where: { id: req.params.id, userId },
        select: { id: true, name: true, status: true, createdAt: true, objective: true },
    });
    if (!c) return apiError(res, 404, 'NOT_FOUND', 'Campaign not found');
    const funnelRows = await prisma.campaignLead.groupBy({
        by: ['status'], where: { campaignId: c.id }, _count: { _all: true },
    }).catch(() => [] as any[]);
    const funnel: Record<string, number> = {};
    for (const r of funnelRows as any[]) funnel[r.status] = r._count._all;
    return res.json({ campaign: { ...c, funnel } });
}

export async function listCampaignLeads(req: any, res: Response) {
    const userId = req.user.id;
    const { limit, offset } = parsePaging(req);
    const camp = await prisma.campaign.findFirst({ where: { id: req.params.id, userId }, select: { id: true } });
    if (!camp) return apiError(res, 404, 'NOT_FOUND', 'Campaign not found');
    const where = { campaignId: camp.id };
    const [rows, total] = await Promise.all([
        prisma.campaignLead.findMany({
            where, take: limit, skip: offset,
            select: { leadId: true, status: true, Lead: { select: LEAD_SELECT } },
        }),
        prisma.campaignLead.count({ where }),
    ]);
    const data = rows.map((r) => ({ ...r.Lead, campaignStatus: r.status }));
    return list(res, data, total, limit, offset);
}

export async function enrollLeads(req: any, res: Response) {
    const userId = req.user.id;
    const camp = await prisma.campaign.findFirst({ where: { id: req.params.id, userId }, select: { id: true } });
    if (!camp) return apiError(res, 404, 'NOT_FOUND', 'Campaign not found');
    const leadIds: string[] = Array.isArray(req.body?.leadIds) ? req.body.leadIds : [];
    if (!leadIds.length) return apiError(res, 400, 'VALIDATION_ERROR', 'leadIds is required', { field: 'leadIds' });
    // Only enroll leads the caller actually owns.
    const owned = await prisma.lead.findMany({ where: { id: { in: leadIds }, userId }, select: { id: true } });
    const result = await prisma.campaignLead.createMany({
        data: owned.map((l) => ({ campaignId: camp.id, leadId: l.id })),
        skipDuplicates: true,
    });
    return res.json({ enrolled: result.count });
}

// Shared launch prechecks (distinct error codes) → delegate to startCampaign.
export async function launchCampaign(req: any, res: Response) {
    const userId = req.user.id;
    const campaign = await prisma.campaign.findFirst({
        where: { id: req.params.id, userId }, select: { id: true, workflowJson: true },
    });
    if (!campaign) return apiError(res, 404, 'NOT_FOUND', 'Campaign not found');

    const li = await checkLinkedInHealthy(userId);
    if (li) return sendPrereq(res, li);
    if (workflowHasEmailSend(campaign.workflowJson)) {
        const em = await checkEmailAccount(userId);
        if (em) return sendPrereq(res, em);
    }
    // startCampaign handles active-campaign, lead-cap, preflight, enqueue and
    // returns {error:'CODE',...} shapes that match our contract.
    return startCampaign(req, res);
}

export async function createFromTemplate(req: any, res: Response) {
    const userId = req.user.id;
    const { templateId, name, objective, tone, cta, description, leadIds, launch } = req.body || {};
    if (req.body?.workflow || req.body?.workflowJson) {
        return apiError(res, 400, 'VALIDATION_ERROR', 'Custom workflows are not allowed — use a templateId.', { field: 'workflow' });
    }
    if (!templateId || !name) {
        return apiError(res, 400, 'VALIDATION_ERROR', 'templateId and name are required',
            { missingFields: [!templateId && 'templateId', !name && 'name'].filter(Boolean) });
    }
    const t = getTemplateById(templateId);
    if (!t) return apiError(res, 404, 'NOT_FOUND', 'Template not found');

    const hint: any = t.aiStrategyHint || {};
    const campaign = await prisma.campaign.create({
        data: {
            userId,
            name,
            workflowJson: t.workflow as any,
            objective: objective ?? hint.objective ?? undefined,
            description: description ?? hint.description ?? undefined,
            cta: cta ?? hint.cta ?? undefined,
            toneOverride: tone ?? hint.toneOverride ?? undefined,
            status: 'DRAFT',
        },
        select: { id: true, name: true, status: true },
    });

    if (Array.isArray(leadIds) && leadIds.length) {
        const owned = await prisma.lead.findMany({ where: { id: { in: leadIds }, userId }, select: { id: true } });
        await prisma.campaignLead.createMany({
            data: owned.map((l) => ({ campaignId: campaign.id, leadId: l.id })),
            skipDuplicates: true,
        });
    }

    if (launch === true) {
        req.params = { ...(req.params || {}), id: campaign.id };
        req.body.leadIds = []; // already enrolled; startCampaign counts existing
        return launchCampaign(req, res);
    }
    return res.status(201).json({ campaign });
}

// ── Search & enrich ──────────────────────────────────────────────────────────
export async function searchPeopleHandler(req: any, res: Response) {
    const userId = req.user.id;
    const { keywords, filters, limit, page } = req.body || {};
    if (!keywords) return apiError(res, 400, 'VALIDATION_ERROR', 'keywords is required', { missingFields: ['keywords'] });

    const li = await checkLinkedInHealthy(userId);
    if (li) return sendPrereq(res, li);

    const sq = await checkSearchQuota(userId);
    if (!sq.allowed) {
        return apiError(res, 429, 'QUOTA_EXCEEDED', 'Monthly search limit reached.',
            { quota: 'search', cap: sq.cap, remaining: 0, resetAt: startOfNextMonthUTC(), rollover: false });
    }
    try {
        const result = await searchPeople(userId, { keywords, filters, limit, page });
        await logSearchAction(userId);
        return res.json({ data: result.people, via: result.via, remaining: Math.max(0, sq.remaining - 1) });
    } catch (e: any) {
        return apiError(res, 502, 'INTERNAL', e?.message || 'Search failed');
    }
}

export async function enrichEmailHandler(req: any, res: Response) {
    const userId = req.user.id;
    const { firstName, lastName, company, jobTitle } = req.body || {};
    const missing = [!firstName && 'firstName', !lastName && 'lastName', !company && 'company'].filter(Boolean);
    if (missing.length) return apiError(res, 400, 'VALIDATION_ERROR', 'firstName, lastName, company are required', { missingFields: missing });

    const eq = await checkEmailFinderQuota(userId);
    if (!eq.allowed) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
        const recurring = planFor(user?.tier).emailFinderRecurring;
        return apiError(res, 429, 'QUOTA_EXCEEDED', 'Email-finder credits exhausted for this period.',
            { quota: 'emailCredits', cap: eq.cap, remaining: 0, resetAt: recurring ? startOfNextMonthUTC() : null, rollover: false });
    }
    try {
        const r = await findEmail({ firstName, lastName, company, jobTitle });
        await logEmailFinderAction(userId);
        return res.json({ found: !!r?.email, email: r?.email ?? null, verified: r?.verified ?? false, confidence: r?.confidence ?? null });
    } catch (e: any) {
        return apiError(res, 502, 'INTERNAL', e?.message || 'Enrichment failed');
    }
}

// ── Account / meta ───────────────────────────────────────────────────────────
export async function getMe(req: any, res: Response) {
    const userId = req.user.id;
    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, tier: true, registrationStep: true, accountHealth: true, sessionInvalid: true, linkedinCookie: true },
    });
    if (!u) return apiError(res, 401, 'UNAUTHORIZED', 'Invalid API key');
    return res.json({
        id: u.id,
        email: u.email,
        tier: u.tier,
        onboardingComplete: u.registrationStep === 'COMPLETED',
        linkedin: { connected: !!u.linkedinCookie && !u.sessionInvalid, health: u.accountHealth },
    });
}

export async function getUsage(req: any, res: Response) {
    const userId = req.user.id;
    const [connect, msg, invite, search, email, user] = await Promise.all([
        checkQuota(userId, 'connect'),
        checkQuota(userId, 'send-message'),
        checkInviteQuota(userId),
        checkSearchQuota(userId),
        checkEmailFinderQuota(userId),
        prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }),
    ]);
    const plan = planFor(user?.tier);
    const q = (o: any) => ({ used: o.used, cap: fin(o.cap), remaining: fin(o.remaining) });
    return res.json({
        invites: { ...q(connect), period: 'daily', resetAt: startOfTomorrowUTC() },
        messages: { ...q(msg), period: 'daily', resetAt: startOfTomorrowUTC() },
        monthlyInvites: { ...q(invite), period: 'monthly', resetAt: startOfNextMonthUTC() },
        search: { ...q(search), period: 'monthly', resetAt: startOfNextMonthUTC() },
        emailCredits: {
            ...q(email),
            period: plan.emailFinderRecurring ? 'monthly' : 'one_time',
            resetAt: plan.emailFinderRecurring ? startOfNextMonthUTC() : null,
            rollover: false,
        },
        features: plan.features,
    });
}
