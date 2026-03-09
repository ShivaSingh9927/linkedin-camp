import { Response } from 'express';
import { prisma } from '../server';

export const createCampaign = async (req: any, res: Response) => {
    const { name, workflowJson } = req.body;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.create({
            data: {
                name,
                workflowJson: workflowJson || {},
                userId,
                status: 'DRAFT',
            },
        });
        res.status(201).json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create campaign' });
    }
};

export const getCampaigns = async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        const campaigns = await prisma.campaign.findMany({
            where: { userId },
            include: {
                _count: {
                    select: { leads: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Add progress stats to each campaign for the list view
        const campaignsWithStats = await Promise.all(campaigns.map(async (c) => {
            const completedCount = await prisma.campaignLead.count({
                where: { campaignId: c.id, isCompleted: true }
            });
            const totalCount = await prisma.campaignLead.count({
                where: { campaignId: c.id }
            });
            return {
                ...c,
                stats: {
                    totalLeads: totalCount,
                    completedLeads: completedCount,
                    progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
                }
            };
        }));

        res.json(campaignsWithStats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
};

export const getCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId },
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaign' });
    }
};

export const updateCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, workflowJson, status } = req.body;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.update({
            where: { id, userId },
            data: {
                name,
                workflowJson,
                status,
            },
        });
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update campaign' });
    }
};

export const startCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const { leadIds } = req.body || {};
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const updatedCampaign = await prisma.campaign.update({
            where: { id, userId },
            data: { status: 'ACTIVE' },
        });

        const workflow = campaign.workflowJson as any;
        const startNode = workflow.nodes?.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflow.nodes?.[0];

        let skippedCount = 0;
        let startedCount = 0;

        const leadsToEnroll = (leadIds && Array.isArray(leadIds) && leadIds.length > 0)
            ? leadIds
            : (await prisma.campaignLead.findMany({ where: { campaignId: id } })).map(cl => cl.leadId);

        if (startNode && leadsToEnroll.length > 0) {
            console.log(`[Campaign] Starting Campaign ${id} for User ${userId}. Attempting to enroll ${leadsToEnroll.length} leads.`);

            const activeLeadsInOtherCampaigns = await prisma.campaignLead.findMany({
                where: {
                    leadId: { in: leadsToEnroll },
                    isCompleted: false,
                    campaignId: { not: id }
                },
                select: { leadId: true }
            });

            const activeLeadIds = new Set(activeLeadsInOtherCampaigns.map(cl => cl.leadId));
            const safeLeadIdsToStart = leadsToEnroll.filter((leadId: string) => !activeLeadIds.has(leadId));

            skippedCount = activeLeadIds.size;
            startedCount = safeLeadIdsToStart.length;

            if (skippedCount > 0) {
                console.log(`[SPAM PROTECT] User ${userId} tried to add ${skippedCount} leads to Campaign ${id} that were already active elsewhere.`);
            }

            const firstEdge = workflow.edges?.find((e: any) => e.source === startNode.id);
            const firstStepId = firstEdge ? firstEdge.target : startNode.id;

            if (safeLeadIdsToStart.length > 0) {
                console.log(`[Campaign] Resetting/Enrolling ${safeLeadIdsToStart.length} leads in campaign ${id}`);

                for (const leadId of safeLeadIdsToStart) {
                    await prisma.campaignLead.upsert({
                        where: {
                            campaignId_leadId: { campaignId: id, leadId }
                        },
                        update: {
                            currentStepId: firstStepId,
                            nextActionDate: new Date(),
                            isCompleted: false,
                        },
                        create: {
                            campaignId: id,
                            leadId,
                            currentStepId: firstStepId,
                            nextActionDate: new Date(),
                            isCompleted: false,
                        }
                    });
                }
            }
        }

        res.json({
            ...updatedCampaign,
            meta: {
                startedCount,
                skippedCount
            }
        });
    } catch (error) {
        console.error('Start campaign error:', error);
        res.status(500).json({ error: 'Failed to start campaign' });
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

export const getCampaignStatus = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId },
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const campaignLeads = await prisma.campaignLead.findMany({
            where: { campaignId: id },
            include: { lead: true },
        });

        const totalLeads = campaignLeads.length;
        const completedLeads = campaignLeads.filter(cl => cl.isCompleted).length;
        const progress = totalLeads > 0 ? Math.round((completedLeads / totalLeads) * 100) : 0;

        const stepCounts: Record<string, number> = {};
        campaignLeads.forEach(cl => {
            if (cl.currentStepId && !cl.isCompleted) {
                stepCounts[cl.currentStepId] = (stepCounts[cl.currentStepId] || 0) + 1;
            }
        });

        const activeStepIds = Object.entries(stepCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([stepId]) => stepId);

        const leadsWithLogs = await Promise.all(
            campaignLeads.map(async (cl) => {
                const logs = await prisma.actionLog.findMany({
                    where: { leadId: cl.leadId, userId },
                    orderBy: { executedAt: 'desc' },
                    take: 5,
                });
                return {
                    campaignLeadId: cl.id,
                    lead: {
                        id: cl.lead.id,
                        firstName: cl.lead.firstName,
                        lastName: cl.lead.lastName,
                        linkedinUrl: cl.lead.linkedinUrl,
                    },
                    currentStepId: cl.currentStepId,
                    nextActionDate: cl.nextActionDate,
                    isCompleted: cl.isCompleted,
                    personalization: cl.personalization,
                    recentLogs: logs.map((log) => ({
                        actionType: log.actionType,
                        status: log.status,
                        errorMessage: log.errorMessage,
                        executedAt: log.executedAt,
                    })),
                };
            })
        );

        res.json({
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                stats: {
                    totalLeads,
                    completedLeads,
                    progress,
                    activeStepIds
                }
            },
            leads: leadsWithLogs,
        });
    } catch (error) {
        console.error('Campaign status error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign status' });
    }
};
