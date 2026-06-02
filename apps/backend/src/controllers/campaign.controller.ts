import { Response } from 'express';
import { prisma } from '@repo/db';
import { getOrAssignProxy } from '../services/proxy.service';
import { enqueueCampaign } from '../workers/campaign-worker';
import { leadCapForTier } from '../config/plans';
import { queueCampaign as queueCampaignSvc, unqueueCampaign as unqueueCampaignSvc, reorderQueue } from '../services/campaign-queue.service';
import { estimateCampaignEta } from '../campaign-engine/safety/eta';
import { syncLeadToCRMs } from '../services/crmService';
import { emitCrmEvent, ensureCampaignCrmPolicy } from '../services/crm-events';

export const createCampaign = async (req: any, res: Response) => {
    const { name, workflow, workflowJson, leads, objective, description, cta, toneOverride } = req.body;
    const userId = req.user.id;

    console.log('createCampaign called:', { name, workflow: !!workflow, workflowJson: !!workflowJson, objective: !!objective, description: !!description });

    // Use workflow or workflowJson (frontend sends "workflow")
    const workflowData = workflow || workflowJson;

    if (!name || !workflowData) {
        console.log('Missing fields:', { name: !!name, workflowData: !!workflowData });
        return res.status(400).json({ error: 'Missing name or workflow' });
    }

    try {
        console.log('Creating campaign with data:', { 
            userId, 
            name, 
            workflowData: JSON.stringify(workflowData).substring(0, 100),
            objective: !!objective,
            description: !!description
        });
        const campaign = await prisma.campaign.create({
            data: {
                userId,
                name,
                workflowJson: workflowData,
                objective: objective || undefined,
                description: description || undefined,
                cta: cta || undefined,
                toneOverride: toneOverride || undefined,
                status: 'DRAFT',
            },
        });

        // Add leads to campaign if provided
        if (leads && Array.isArray(leads) && leads.length > 0) {
            for (const leadId of leads) {
                await prisma.campaignLead.create({
                    data: {
                        campaignId: campaign.id,
                        leadId,
                    },
                });
            }
            console.log(`Added ${leads.length} leads to campaign`);
        }

        console.log('Campaign created:', campaign.id);
        res.status(201).json(campaign);
    } catch (error: any) {
        console.error('createCampaign error:', error);
        res.status(500).json({ error: 'Failed to create campaign: ' + error.message });
    }
};

export const updateCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, workflowJson, objective, description, cta, toneOverride } = req.body;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.update({
            where: { id, userId },
            data: {
                name,
                workflowJson,
                objective: objective !== undefined ? objective : undefined,
                description: description !== undefined ? description : undefined,
                cta: cta !== undefined ? cta : undefined,
                toneOverride: toneOverride !== undefined ? toneOverride : undefined,
            },
        });
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update campaign' });
    }
};

export const getCampaigns = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const campaigns = await prisma.campaign.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
};

export const getCampaignById = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId },
        });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaign' });
    }
};

export const startCampaign = async (req: any, res: Response) => {
    console.log('startCampaign called, id:', req.params.id);
    const { id } = req.params;
    const userId = req.user.id;
    const { leadIds = [] } = req.body || {};
    console.log('startCampaign params:', { id, userId, leadIdsCount: leadIds.length });

    try {
        console.log('Starting campaign...');
        // Ensure user has a proxy assigned before starting campaign actions
        await getOrAssignProxy(userId);

        const campaign = await prisma.campaign.findUnique({
            where: { id, userId }
        });

        console.log('Campaign found:', campaign ? 'yes' : 'no');
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Resolve the effective lead set up front so caps + queue decisions
        // can be made before any DB write.
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true },
        });
        const leadCap = leadCapForTier(user?.tier as any);

        let effectiveLeadCount = leadIds.length;
        if (effectiveLeadCount === 0) {
            effectiveLeadCount = await prisma.campaignLead.count({ where: { campaignId: id } });
        }

        if (effectiveLeadCount > leadCap) {
            return res.status(400).json({
                error: 'LEAD_CAP_EXCEEDED',
                message: `Your plan allows ${leadCap} leads per campaign (got ${effectiveLeadCount}). Reduce the lead count or upgrade your plan.`,
                cap: leadCap,
                provided: effectiveLeadCount,
            });
        }

        // 1-active-per-user invariant. LinkedIn caps an account at ~58
        // actions/day, so running multiple campaigns in parallel doesn't
        // raise throughput — it just confuses progress reporting. The user
        // should explicitly queue the campaign instead.
        const existingActive = await prisma.campaign.findFirst({
            where: { userId, status: 'ACTIVE', id: { not: id } },
            select: { id: true, name: true },
        });
        if (existingActive) {
            return res.status(409).json({
                error: 'ACTIVE_CAMPAIGN_EXISTS',
                message: `You already have an active campaign ("${existingActive.name}"). Pause it, wait for it to finish, or queue this campaign to run next.`,
                activeCampaignId: existingActive.id,
            });
        }

        const updatedCampaign = await prisma.campaign.update({
            where: { id, userId },
            data: { status: 'ACTIVE', queuePosition: null },
        });

        console.log('Campaign status updated to ACTIVE');

        // Identify the start node from WorkflowJson.
        // Accept three shapes: { nodes:[...], edges:[...] } (React Flow),
        // [...] (plain array), and { flow:[...] } (engine's linear form).
        const workflow = campaign.workflowJson as any;
        const rawNodes = workflow?.nodes || workflow?.flow || workflow;
        const workflowNodes = Array.isArray(rawNodes) ? rawNodes : [];
        console.log('Workflow:', workflow ? 'exists' : 'null', 'nodes:', workflowNodes.length);
        const startNode = workflowNodes.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflowNodes[0];
        console.log('startNode:', startNode?.id, startNode?.type);

        let skippedCount = 0;
        let startedCount = 0;

        if (startNode) {
            let finalLeadIds = leadIds;
            console.log('finalLeadIds initial:', finalLeadIds.length);

            // IF leadIds is empty, fetch campaign leads
            if (!finalLeadIds || finalLeadIds.length === 0) {
                console.log(`[Campaign] No leadIds provided. Fetching campaign leads for campaign ${id}.`);
                const campaignLeads = await prisma.campaignLead.findMany({
                    where: { campaignId: id },
                    select: { leadId: true }
                });
                finalLeadIds = campaignLeads.map((el: any) => el.leadId);
                console.log('Fetched campaign leads:', finalLeadIds.length);
            }

            console.log('Final leadIds to process:', finalLeadIds.length);

            if (finalLeadIds && finalLeadIds.length > 0) {
                console.log(`[Campaign] Starting Campaign ${id} for User ${userId}. Attempting to enroll ${finalLeadIds.length} leads.`);

                // 1. Anti-Spam Failsafe: Prevent leads from being active in multiple campaigns simultaneously
                const activeLeadsInOtherCampaigns = await prisma.campaignLead.findMany({
                    where: {
                        leadId: { in: finalLeadIds },
                        isCompleted: false,
                        campaignId: { not: id }
                    },
                    select: { leadId: true }
                });

                const activeLeadIds = new Set(activeLeadsInOtherCampaigns.map((cl: any) => cl.leadId));
                const safeLeadIdsToStart = finalLeadIds.filter((leadId: string) => !activeLeadIds.has(leadId));

                skippedCount = activeLeadIds.size;
                startedCount = safeLeadIdsToStart.length;

                console.log(`[Campaign] Enrollment Stats: ${startedCount} safe, ${skippedCount} skipped (already active).`);

                if (skippedCount > 0) {
                    console.log(`[SPAM PROTECT] User ${userId} tried to add ${skippedCount} leads to Campaign ${id} that were already active elsewhere.`);
                }

                // Find the immediate next node after trigger
                const firstEdge = workflow.edges?.find((e: any) => e.source === startNode.id);
                const firstStepId = firstEdge ? firstEdge.target : startNode.id;

                console.log(`[Campaign] Workflow start detected. Start Node: ${startNode.id}, First Action Step: ${firstStepId}`);

                if (safeLeadIdsToStart.length > 0) {
                    console.log(`[Campaign] Resetting/Enrolling ${safeLeadIdsToStart.length} leads in campaign ${id}`);

                    // Use a transaction or bulk operation where possible, but upsert is fine for small tests
                    for (const leadId of safeLeadIdsToStart) {
                        const leadIdRecord = await prisma.campaignLead.findUnique({
                            where: { campaignId_leadId: { campaignId: id, leadId } }
                        });

                        console.log(`Processing leadId: ${leadId}, existing record: ${leadIdRecord ? 'yes' : 'no'}`);

                        if (leadIdRecord) {
                            await prisma.campaignLead.update({
                                where: { campaignId_leadId: { campaignId: id, leadId } },
                                data: {
                                    currentStepId: firstStepId,
                                    nextActionDate: new Date(),
                                    isCompleted: false,
                                }
                            });
                        } else {
                            await prisma.campaignLead.create({
                                data: {
                                    id: require('crypto').randomUUID(),
                                    campaignId: id,
                                    leadId,
                                    currentStepId: firstStepId,
                                    nextActionDate: new Date(),
                                    isCompleted: false,
                                    status: 'PENDING'
                                }
                            });
                        }
                    }

                    if (safeLeadIdsToStart.length > 0) {
                        await enqueueCampaign(userId, id);

                        // Create the CRM sync policy row (idempotent) and
                        // emit lead.added per enrolled lead. Fire-and-forget;
                        // policy-driven, so users with no CRM connected
                        // produce zero downstream work.
                        ensureCampaignCrmPolicy(id, userId).catch(err =>
                            console.error('[Campaign] ensureCrmPolicy failed:', err.message)
                        );
                        for (const leadId of safeLeadIdsToStart) {
                            emitCrmEvent({ event: 'lead.added', userId, campaignId: id, leadId });
                        }
                    }

                    console.log(`[Campaign] Successfully started/enrolled ${safeLeadIdsToStart.length} leads.`);
                }
            } else {
                console.warn(`[Campaign] Skipping enrollment logic. finalLeadIds length: 0`);
            }
        } else {
            console.warn(`[Campaign] Skipping enrollment logic. No startNode present: ${!!startNode}`);
        }

        res.json({
            ...updatedCampaign,
            meta: { startedCount, skippedCount }
        });
    } catch (error: any) {
        console.error('Start campaign error:', error);
        res.status(500).json({ error: 'Failed to start campaign: ' + error.message });
    }
};

export const pauseCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.update({
            where: { id, userId },
            data: { status: 'PAUSED' },
        });
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to pause campaign' });
    }
};

export const queueCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const updated = await queueCampaignSvc(userId, id);
        res.json(updated);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const unqueueCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const updated = await unqueueCampaignSvc(userId, id);
        res.json(updated);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const reorderQueueHandler = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of campaign IDs' });
    try {
        const final = await reorderQueue(userId, order);
        res.json({ order: final });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

/**
 * Compact overview payload for the dedicated campaign detail page:
 * header strip data, KPI counts, progress, and the most-recent action
 * (used to power the "Currently …" live ribbon — falls back to flavor
 * copy on the frontend when null).
 */
export const getCampaignOverview = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId },
            select: {
                id: true, name: true, status: true, queuePosition: true,
                createdAt: true, objective: true,
            },
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const totalLeads = await prisma.campaignLead.count({ where: { campaignId: id } });
        const completedLeads = await prisma.campaignLead.count({
            where: { campaignId: id, isCompleted: true },
        });

        // Per-action-type tallies from ActionLog scoped to this campaign.
        // groupBy keeps this cheap even on large campaigns.
        const actionTallies = await prisma.actionLog.groupBy({
            by: ['actionType'],
            where: { campaignId: id, status: 'SUCCESS' },
            _count: { _all: true },
        });
        const tally = (t: string) => actionTallies.find(a => a.actionType === t)?._count._all ?? 0;

        const repliedLeads = await prisma.lead.count({
            where: {
                status: 'REPLIED',
                CampaignLead: { some: { campaignId: id } },
            },
        });

        const kpis = {
            totalLeads,
            invited: tally('connect'),
            connected: tally('connect-accept'),
            messaged: tally('send-message'),
            replied: repliedLeads,
            replyRatePct: totalLeads ? Math.round((repliedLeads / totalLeads) * 100) : 0,
        };

        const progressPct = totalLeads ? Math.round((completedLeads / totalLeads) * 100) : 0;
        const eta = estimateCampaignEta(totalLeads, campaign.createdAt);

        // "Currently" = most recent SUCCESS action in the last 60s. Older
        // than that and we treat the worker as idle so the frontend swaps
        // in flavor copy.
        const recentCutoff = new Date(Date.now() - 60 * 1000);
        const latest = await prisma.actionLog.findFirst({
            where: { campaignId: id, executedAt: { gte: recentCutoff } },
            orderBy: { executedAt: 'desc' },
            select: { actionType: true, executedAt: true, leadId: true },
        });
        let currentlyProcessing: any = null;
        if (latest?.leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: latest.leadId },
                select: { firstName: true, lastName: true, company: true },
            });
            currentlyProcessing = {
                action: latest.actionType,
                leadName: lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : 'lead',
                leadCompany: lead?.company || null,
                at: latest.executedAt,
            };
        }

        res.json({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            queuePosition: campaign.queuePosition,
            objective: campaign.objective,
            startedAt: campaign.createdAt,
            estimatedCompletionAt: eta.completionDate,
            estimatedTotalDays: eta.calendarDays,
            progressPct,
            kpis,
            currentlyProcessing,
        });
    } catch (err: any) {
        console.error('getCampaignOverview error:', err);
        res.status(500).json({ error: 'Failed to fetch overview: ' + err.message });
    }
};

/**
 * Funnel + 7-day actions series for the campaign detail page chart row.
 * - stages: 6 horizontal bars (Total → Visited → Invited → Connected →
 *           Messaged → Replied). Counts are SUCCESS-only from ActionLog
 *           except `total` (from CampaignLead) and `replied` (Lead.status).
 * - dailySeries: per-day invite/message/reply counts over the last 7 days
 *           for the line chart.
 */
export const getCampaignFunnel = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const exists = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
        if (!exists) return res.status(404).json({ error: 'Campaign not found' });

        const totalLeads = await prisma.campaignLead.count({ where: { campaignId: id } });

        const tallies = await prisma.actionLog.groupBy({
            by: ['actionType'],
            where: { campaignId: id, status: 'SUCCESS' },
            _count: { _all: true },
        });
        const t = (k: string) => tallies.find(a => a.actionType === k)?._count._all ?? 0;

        const repliedLeads = await prisma.lead.count({
            where: { status: 'REPLIED', CampaignLead: { some: { campaignId: id } } },
        });

        const stages = [
            { key: 'total',     label: 'Leads',           count: totalLeads },
            { key: 'visited',   label: 'Profile visited', count: t('profile-visit') },
            { key: 'invited',   label: 'Invite sent',     count: t('connect') },
            { key: 'connected', label: 'Connection made', count: t('connect-accept') },
            { key: 'messaged',  label: 'Message sent',    count: t('send-message') },
            { key: 'replied',   label: 'Replied',         count: repliedLeads },
        ];

        // 7-day rolling series for invites / messages / replies. Compute
        // bucket keys client-side-safely (UTC dates) so the timezone of
        // the API host doesn't shift bars under the user.
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        since.setUTCHours(0, 0, 0, 0);
        const logs = await prisma.actionLog.findMany({
            where: {
                campaignId: id, status: 'SUCCESS',
                executedAt: { gte: since },
                actionType: { in: ['connect', 'send-message'] },
            },
            select: { actionType: true, executedAt: true },
        });
        const byDay: Record<string, { invites: number; messages: number; replies: number }> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
            byDay[d.toISOString().slice(0, 10)] = { invites: 0, messages: 0, replies: 0 };
        }
        for (const l of logs) {
            const k = new Date(l.executedAt).toISOString().slice(0, 10);
            if (!byDay[k]) continue;
            if (l.actionType === 'connect') byDay[k].invites++;
            if (l.actionType === 'send-message') byDay[k].messages++;
        }
        // Replies don't have an ActionLog of their own — proxy via Lead
        // status change timestamps would be ideal but we don't track that
        // yet. Leave replies=0 in dailySeries for now; the funnel still
        // shows the total. (Followup: add Lead.statusChangedAt.)
        const dailySeries = Object.entries(byDay).map(([date, v]) => ({ date, ...v }));

        res.json({ stages, dailySeries });
    } catch (err: any) {
        console.error('getCampaignFunnel error:', err);
        res.status(500).json({ error: 'Failed to fetch funnel: ' + err.message });
    }
};

/**
 * Paginated lead list for the campaign Leads tab.
 * Filters:
 *   stage  — 'all' | 'pending' | 'in_progress' | 'replied' | 'completed' | 'failed'
 *   q      — substring search across firstName/lastName/company/jobTitle
 *   page, limit
 */
export const getCampaignLeads = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const stage = (req.query.stage as string) || 'all';
    const q = (req.query.q as string)?.trim();
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt((req.query.limit as string) || '50', 10)));

    try {
        const campaign = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // CampaignLead.status is LeadStatus: IMPORTED | PENDING | CONNECTED
        // | REPLIED | BOUNCED. We translate UI buckets onto these:
        //   in_progress = has run but not terminal (CONNECTED, has acted)
        //   failed = BOUNCED
        const where: any = { campaignId: id };
        switch (stage) {
            case 'pending':     where.status = 'PENDING'; where.isCompleted = false; break;
            case 'in_progress': where.status = 'CONNECTED'; where.isCompleted = false; break;
            case 'replied':     where.status = 'REPLIED'; break;
            case 'completed':   where.isCompleted = true; break;
            case 'failed':      where.status = 'BOUNCED'; break;
            // 'all' → no extra filter
        }
        if (q) {
            where.Lead = {
                OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName:  { contains: q, mode: 'insensitive' } },
                    { company:   { contains: q, mode: 'insensitive' } },
                    { jobTitle:  { contains: q, mode: 'insensitive' } },
                ],
            };
        }

        const total = await prisma.campaignLead.count({ where });
        const rows = await prisma.campaignLead.findMany({
            where,
            include: { Lead: true },
            orderBy: [{ lastActionAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        });

        // Stage filter chip counts so the UI doesn't need a second roundtrip.
        // groupBy across all leads in this campaign — cheap, single query.
        const counts = await prisma.campaignLead.groupBy({
            by: ['status', 'isCompleted'],
            where: { campaignId: id },
            _count: { _all: true },
        });
        const stageCounts = { all: 0, pending: 0, in_progress: 0, replied: 0, completed: 0, failed: 0 };
        for (const c of counts) {
            stageCounts.all += c._count._all;
            if (c.isCompleted) stageCounts.completed += c._count._all;
            else if (c.status === 'PENDING')   stageCounts.pending     += c._count._all;
            else if (c.status === 'CONNECTED') stageCounts.in_progress += c._count._all;
            if (c.status === 'REPLIED') stageCounts.replied += c._count._all;
            if (c.status === 'BOUNCED') stageCounts.failed  += c._count._all;
        }

        const leads = rows.map(r => ({
            id: r.Lead.id,
            campaignLeadId: r.id,
            name: `${r.Lead.firstName ?? ''} ${r.Lead.lastName ?? ''}`.trim() || 'Unknown',
            company: r.Lead.company,
            jobTitle: r.Lead.jobTitle,
            linkedinUrl: r.Lead.linkedinUrl,
            stage: r.isCompleted ? 'completed' : r.status.toLowerCase(),
            lastActionAt: r.lastActionAt,
            nextActionAt: r.nextActionDate,
        }));

        res.json({ leads, total, page, limit, stageCounts });
    } catch (err: any) {
        console.error('getCampaignLeads error:', err);
        res.status(500).json({ error: 'Failed to fetch leads: ' + err.message });
    }
};

/**
 * Bulk-sync selected leads to the user's configured CRMs. Iterates the
 * existing per-lead syncLeadToCRMs (HubSpot/Pipedrive/Notion). Capped
 * at 200 IDs per call so a runaway selection can't hammer the providers.
 */
export const bulkSyncLeadsToCRM = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { leadIds } = req.body || {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'leadIds must be a non-empty array' });
    }
    if (leadIds.length > 200) return res.status(400).json({ error: 'Maximum 200 leads per bulk sync' });

    const exists = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Campaign not found' });

    // Defensive — only sync leads that actually belong to this campaign.
    const valid = await prisma.campaignLead.findMany({
        where: { campaignId: id, leadId: { in: leadIds } },
        select: { leadId: true },
    });
    const validIds = valid.map(v => v.leadId);

    const results: Array<{ leadId: string; providers: any[] }> = [];
    let ok = 0, failed = 0;
    for (const leadId of validIds) {
        try {
            const r = await syncLeadToCRMs(userId, leadId);
            results.push({ leadId, providers: r });
            if (r.every(p => p.success)) ok++; else failed++;
        } catch (err: any) {
            results.push({ leadId, providers: [{ error: err.message }] });
            failed++;
        }
    }
    res.json({ ok, failed, total: validIds.length, results });
};

/**
 * Move a set of leads from this campaign into a target campaign. The
 * target must belong to the same user. Respects the anti-spam rule —
 * a lead currently active in any OTHER campaign is rejected for that
 * lead only (not the whole batch).
 */
export const bulkMoveLeadsToCampaign = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { leadIds, targetCampaignId } = req.body || {};
    if (!Array.isArray(leadIds) || !leadIds.length || !targetCampaignId) {
        return res.status(400).json({ error: 'leadIds[] and targetCampaignId required' });
    }
    if (leadIds.length > 200) return res.status(400).json({ error: 'Maximum 200 leads per bulk move' });
    if (targetCampaignId === id) return res.status(400).json({ error: 'Target campaign must differ from source' });

    const [src, tgt] = await Promise.all([
        prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } }),
        prisma.campaign.findFirst({ where: { id: targetCampaignId, userId }, select: { id: true } }),
    ]);
    if (!src) return res.status(404).json({ error: 'Source campaign not found' });
    if (!tgt) return res.status(404).json({ error: 'Target campaign not found' });

    // Anti-spam: lead already active elsewhere (other than source) is blocked.
    const activeElsewhere = await prisma.campaignLead.findMany({
        where: { leadId: { in: leadIds }, isCompleted: false, campaignId: { notIn: [id] } },
        select: { leadId: true },
    });
    const blocked = new Set(activeElsewhere.map(a => a.leadId));
    const movable = leadIds.filter((x: string) => !blocked.has(x));

    let moved = 0;
    for (const leadId of movable) {
        try {
            await prisma.campaignLead.upsert({
                where: { campaignId_leadId: { campaignId: targetCampaignId, leadId } },
                create: { id: require('crypto').randomUUID(), campaignId: targetCampaignId, leadId, isCompleted: false, status: 'PENDING' },
                update: { isCompleted: false, status: 'PENDING' },
            });
            moved++;
        } catch (e) {
            // Skip individual failures; reported in summary.
        }
    }
    res.json({ moved, blocked: blocked.size, total: leadIds.length });
};

/**
 * Audit log of messages sent in this campaign. Used by the Messages tab.
 * Joins Lead for name/company headers; correlates outbound messages with
 * any inbound reply for the same lead by closest timestamp.
 */
export const getCampaignMessages = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt((req.query.limit as string) || '50', 10)));

    const exists = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Campaign not found' });

    const where = { campaignId: id, userId };
    const total = await prisma.message.count({ where });
    const rows = await prisma.message.findMany({
        where,
        include: { Lead: { select: { id: true, firstName: true, lastName: true, company: true, jobTitle: true, linkedinUrl: true, status: true } } },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });

    // For each OUTBOUND message, find the FIRST inbound message from the
    // same lead afterwards — that's the "reply" we display next to it.
    // One query for all replies, grouped client-side.
    const leadIds = [...new Set(rows.map(r => r.leadId))];
    const inbound = await prisma.message.findMany({
        where: { userId, leadId: { in: leadIds }, direction: 'INBOUND' },
        orderBy: { sentAt: 'asc' },
        select: { leadId: true, content: true, sentAt: true },
    });
    const firstReplyAfter: Record<string, { content: string; sentAt: Date } | null> = {};
    const messages = rows.map(m => {
        let reply: { content: string; sentAt: Date } | null = null;
        if (m.direction === 'OUTBOUND') {
            reply = inbound.find(r => r.leadId === m.leadId && r.sentAt > m.sentAt) || null;
        }
        return {
            id: m.id,
            leadId: m.leadId,
            leadName: `${m.Lead?.firstName ?? ''} ${m.Lead?.lastName ?? ''}`.trim() || 'Unknown',
            leadCompany: m.Lead?.company,
            leadJobTitle: m.Lead?.jobTitle,
            linkedinUrl: m.Lead?.linkedinUrl,
            direction: m.direction,
            content: m.content,
            source: m.source, // AI / MANUAL / TEMPLATE
            sentAt: m.sentAt,
            reply,
        };
    });

    res.json({ messages, total, page, limit });
};

/**
 * Performance analytics. Three angles:
 *   - replyRateOverTime: 7-day reply rate by day
 *   - byJobTitle: top 5 job titles by reply rate (min 3 leads)
 *   - byCompanyDomain: top 5 company-buckets by reply rate (min 3 leads)
 * Best-message analysis requires per-variant tracking we don't yet have;
 * deferred until message variants are first-class.
 */
export const getCampaignPerformance = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    const exists = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Campaign not found' });

    const leads = await prisma.campaignLead.findMany({
        where: { campaignId: id },
        include: { Lead: { select: { status: true, jobTitle: true, company: true } } },
    });
    const total = leads.length;
    const replied = leads.filter(l => l.Lead?.status === 'REPLIED').length;
    const overallReplyRate = total ? Math.round((replied / total) * 1000) / 10 : 0;

    // Group helper
    function group(key: 'jobTitle' | 'company') {
        const map: Record<string, { total: number; replied: number }> = {};
        for (const l of leads) {
            const k = (l.Lead?.[key] || 'Unspecified').trim();
            if (!map[k]) map[k] = { total: 0, replied: 0 };
            map[k].total++;
            if (l.Lead?.status === 'REPLIED') map[k].replied++;
        }
        return Object.entries(map)
            .filter(([_, v]) => v.total >= 3)
            .map(([label, v]) => ({ label, leads: v.total, replied: v.replied, rate: Math.round((v.replied / v.total) * 1000) / 10 }))
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5);
    }

    // Reply timeline: count of newly-REPLIED leads per day over last 14 days.
    // Proxied via Message INBOUND timestamps since we don't have Lead.statusChangedAt.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const replies = await prisma.message.findMany({
        where: { userId, direction: 'INBOUND', sentAt: { gte: since }, Lead: { CampaignLead: { some: { campaignId: id } } } },
        select: { sentAt: true, leadId: true },
    });
    const byDay: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
        const d = new Date(since.getTime() + i * 86400000);
        byDay[d.toISOString().slice(0, 10)] = 0;
    }
    // Count distinct leads per day (multiple inbound msgs same day = 1)
    const seen: Record<string, Set<string>> = {};
    for (const r of replies) {
        const k = r.sentAt.toISOString().slice(0, 10);
        if (!seen[k]) seen[k] = new Set();
        seen[k].add(r.leadId);
    }
    for (const k of Object.keys(byDay)) byDay[k] = seen[k]?.size ?? 0;
    const replyTimeline = Object.entries(byDay).map(([date, count]) => ({ date, replies: count }));

    res.json({
        overall: { totalLeads: total, replies: replied, replyRatePct: overallReplyRate },
        byJobTitle: group('jobTitle'),
        byCompany: group('company'),
        replyTimeline,
    });
};

export const getCampaignEta = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const leadCount = await prisma.campaignLead.count({
        where: { campaignId: id, Campaign: { userId } },
    });
    res.json({ leadCount, ...estimateCampaignEta(leadCount) });
};

export const deleteCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await prisma.campaignLead.deleteMany({ where: { campaignId: id } });
        await prisma.campaign.delete({ where: { id, userId } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
};

// New endpoint: detailed campaign status with summary
export const getCampaignStatus = async (req: any, res: Response) => {
    console.log('getCampaignStatus called, id:', req.params.id);
    const { id } = req.params;
    const userId = req.user.id;
    try {
        console.log('Fetching campaign with id: ' + id + ' userId: ' + userId);
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId },
            include: {
                CampaignLead: {
                    include: { Lead: true },
                    orderBy: { lastActionAt: 'desc' }
                }
            }
        });

        console.log('Campaign found:', campaign ? 'yes' : 'no');
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Fetch all relevant action logs for these leads
        const leadIds = campaign.CampaignLead.map(cl => cl.leadId);
        const allLogs = await prisma.actionLog.findMany({
            where: {
                leadId: { in: leadIds }
            },
            orderBy: { executedAt: 'desc' }
        });

        // Group logs by leadId and optionally filter by campaignId if the field exists
        const logsMap: Record<string, any[]> = {};
        allLogs.forEach(log => {
            const logAsAny = log as any;
            // Only include logs for this campaign if the field exists, otherwise include all for these leads
            if (!('campaignId' in logAsAny) || !logAsAny.campaignId || logAsAny.campaignId === id) {
                if (!logsMap[log.leadId!]) logsMap[log.leadId!] = [];
                if (logsMap[log.leadId!].length < 5) logsMap[log.leadId!].push(log);
            }
        });

        // Build summary
        const summary = campaign.CampaignLead.map(cl => {
            const lead = cl.Lead;
            const recentLogs = logsMap[lead.id!] || [];
            return {
                leadId: lead.id,
                name: `${lead.firstName} ${lead.lastName}`,
                linkedinUrl: lead.linkedinUrl,
                isCompleted: cl.isCompleted,
                currentStepId: cl.currentStepId,
                lastActionAt: cl.lastActionAt,
                nextActionDate: cl.nextActionDate,
                recentLogs: recentLogs.map(l => ({
                    type: l.type,
                    createdAt: l.executedAt,
                    success: l.success,
                    message: l.message
                }))
            };
        });

        res.json({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            totalLeads: campaign.CampaignLead.length,
            completedLeads: campaign.CampaignLead.filter(cl => cl.isCompleted).length,
            leads: summary,
        });

    } catch (error: any) {
        console.error('getCampaignStatus error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign status: ' + error.message });
    }
};

export const removeLeadFromCampaign = async (req: any, res: Response) => {
    const { id: campaignId, leadId } = req.params;
    const userId = req.user.id; // Verify ownership if needed

    try {
        await prisma.campaignLead.delete({
            where: {
                campaignId_leadId: {
                    campaignId,
                    leadId
                }
            }
        });
        res.json({ success: true, message: 'Lead removed from campaign' });
    } catch (error) {
        console.error('Error removing lead from campaign:', error);
        res.status(500).json({ error: 'Failed to remove lead from campaign' });
    }
};

// ---- Export Campaign Data ----
export const exportCampaign = async (req: any, res: Response) => {
    const { id: campaignId } = req.params;
    const { format = 'json' } = req.query; // json or csv
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId, userId },
            include: {
                CampaignLead: {
                    include: { Lead: true }
                }
            }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Build export data
        const exportData = campaign.CampaignLead.map(cl => {
            const pl = cl as any;
            const nodeOutputs = pl.personalization?.nodeOutputs || {};
            const execLog = pl.personalization?.execLog || [];
            
            // Get profile-visit output
            const pv = nodeOutputs['profile-visit'] || {};
            
            // Get message output
            const msg = nodeOutputs['send-message'] || {};
            
            // Get connect output
            const conn = nodeOutputs['connect'] || {};

            return {
                // Lead Info
                firstName: cl.Lead.firstName,
                lastName: cl.Lead.lastName,
                email: cl.Lead.email || pv.email,
                linkedinUrl: cl.Lead.linkedinUrl,
                
                // Enrichment
                company: cl.Lead.company || pv.company,
                jobTitle: cl.Lead.jobTitle || pv.jobTitle,
                about: cl.Lead.aboutInfo || pv.about,
                
                // Campaign Status
                status: cl.status,
                isCompleted: cl.isCompleted,
                currentStep: cl.currentStepId,
                lastAction: cl.lastActionAt,
                
                // Action Results
                connectionStatus: conn.status || '',
                messageSent: msg.sent || false,
                messageText: msg.messageText || '',
                likedPost: nodeOutputs['like-nth-post']?.liked || false,
                commentedPost: nodeOutputs['comment-nth-post']?.commented || false,
                
                // Execution Log Summary
                totalSteps: execLog.length,
                successSteps: execLog.filter((e: any) => e.status === 'success').length,
                failedSteps: execLog.filter((e: any) => e.status === 'failed').length,
                lastExecuted: execLog.length > 0 ? execLog[execLog.length - 1].at : null,
            };
        });

        if (format === 'csv') {
            // Convert to CSV
            const headers = Object.keys(exportData[0] || {});
            const csvRows = exportData.map((row: any) => 
                headers.map(h => {
                    const val = row[h];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'object') return JSON.stringify(val);
                    // Escape commas
                    const str = String(val);
                    return str.includes(',') ? `"${str}"` : str;
                }).join(',')
            );
            
            const csv = [headers.join(','), ...csvRows].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-export.csv"`);
            return res.send(csv);
        }

        res.json({
            campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
            exportedAt: new Date().toISOString(),
            totalLeads: exportData.length,
            data: exportData,
        });
    } catch (error) {
        console.error('Export campaign error:', error);
        res.status(500).json({ error: 'Failed to export campaign' });
    }
};

// ─── CRM sync policy + audit ────────────────────────────────────────────────

const POLICY_FLAGS = [
    'enabled', 'syncOnAdded', 'syncOnConnected', 'syncOnMessaged',
    'syncOnReplied', 'syncOnBounced', 'syncOnCompleted', 'createTaskOnReply',
] as const;

export const getCampaignCrmPolicy = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const campaign = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { hubspotToken: true, pipedriveToken: true, notionToken: true, notionDatabaseId: true, email: true },
        });
        const connected = {
            hubspot: !!user?.hubspotToken,
            pipedrive: !!user?.pipedriveToken,
            notion: !!(user?.notionToken && user?.notionDatabaseId),
        };

        let policy = await prisma.campaignCrmPolicy.findUnique({ where: { campaignId: id } });
        if (!policy) {
            // Synthesize a default-shaped response without inserting — the row
            // is created lazily on first start. UI shows the toggles either way.
            policy = {
                campaignId: id,
                enabled: false,
                syncOnAdded: true,
                syncOnConnected: true,
                syncOnMessaged: false,
                syncOnReplied: true,
                syncOnBounced: true,
                syncOnCompleted: false,
                createTaskOnReply: true,
                ownerEmail: user?.email || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any;
        }

        res.json({ policy, connected, hasAnyCrm: connected.hubspot || connected.pipedrive || connected.notion });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateCampaignCrmPolicy = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const campaign = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const body = req.body || {};
        const patch: Record<string, any> = {};
        for (const f of POLICY_FLAGS) {
            if (typeof body[f] === 'boolean') patch[f] = body[f];
        }
        if (typeof body.ownerEmail === 'string') patch.ownerEmail = body.ownerEmail.trim() || null;

        const policy = await prisma.campaignCrmPolicy.upsert({
            where: { campaignId: id },
            create: { campaignId: id, ...patch },
            update: patch,
        });
        res.json({ policy });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getCampaignCrmEvents = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    try {
        const campaign = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const events = await prisma.crmSyncEvent.findMany({
            where: { campaignId: id },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        const leadIds = Array.from(new Set(events.map(e => e.leadId)));
        const leads = leadIds.length
            ? await prisma.lead.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, firstName: true, lastName: true, company: true },
            })
            : [];
        const leadMap = new Map(leads.map(l => [l.id, l]));

        res.json({
            events: events.map(e => ({
                ...e,
                lead: leadMap.get(e.leadId) || null,
            })),
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
