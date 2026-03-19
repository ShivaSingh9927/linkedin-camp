import { Response } from 'express';
import { prisma } from '@repo/db';
import { getOrAssignProxy } from '../services/proxy.service';

export const createCampaign = async (req: any, res: Response) => {
    const { name, workflowJson } = req.body;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.create({
            data: {
                userId,
                name,
                workflowJson,
                status: 'DRAFT',
            },
        });
        res.status(201).json(campaign);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create campaign' });
    }
};

export const updateCampaign = async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, workflowJson } = req.body;
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.update({
            where: { id, userId },
            data: {
                name,
                workflowJson
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
    const { id } = req.params;
    const userId = req.user.id;
    const { leadIds = [] } = req.body || {};

    try {
        // Ensure user has a proxy assigned before starting campaign actions
        await getOrAssignProxy(userId);

        const campaign = await prisma.campaign.findUnique({
            where: { id, userId }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const updatedCampaign = await prisma.campaign.update({
            where: { id, userId },
            data: { status: 'ACTIVE' },
        });

        // Identify the start node from WorkflowJson
        const workflow = campaign.workflowJson as any;
        const startNode = workflow.nodes?.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflow.nodes?.[0];

        let skippedCount = 0;
        let startedCount = 0;

        if (startNode) {
            let finalLeadIds = leadIds;

            // IF leadIds is empty, fetch existing leads for this campaign
            if (!finalLeadIds || finalLeadIds.length === 0) {
                console.log(`[Campaign] No leadIds provided. Fetching existing leads for campaign ${id} to start them.`);
                const existingLeads = await prisma.campaignLead.findMany({
                    where: { campaignId: id, isCompleted: false },
                    select: { leadId: true }
                });
                finalLeadIds = existingLeads.map((el: any) => el.leadId);
            }

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
                        await prisma.campaignLead.upsert({
                            where: { campaignId_leadId: { campaignId: id, leadId } },
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
                    console.log(`[Campaign] Successfully started/enrolled ${safeLeadIdsToStart.length} leads.`);
                }
            } else {
                console.warn(`[Campaign] Skipping enrollment logic. leadIds length: 0 and no existing leads found for campaign ${id}`);
            }
        } else {
            console.warn(`[Campaign] Skipping enrollment logic. No startNode present: ${!!startNode}`);
        }

        res.json({
            ...updatedCampaign,
            meta: { startedCount, skippedCount }
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

// New endpoint: detailed campaign status with summary
export const getCampaignStatus = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id, userId },
            include: {
                leads: {
                    include: { lead: true },
                    orderBy: { lastActionAt: 'desc' }
                }
            }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Fetch all relevant action logs for these leads in this campaign in one go
        const leadIds = campaign.leads.map(cl => cl.leadId);
        const allLogs = await prisma.actionLog.findMany({
            where: {
                campaignId: id,
                leadId: { in: leadIds }
            },
            orderBy: { executedAt: 'desc' }
        });

        // Group logs by leadId
        const logsMap: Record<string, any[]> = {};
        allLogs.forEach(log => {
            if (!logsMap[log.leadId!]) logsMap[log.leadId!] = [];
            if (logsMap[log.leadId!].length < 5) logsMap[log.leadId!].push(log);
        });

        const leadsWithLogs = campaign.leads.map(cl => ({
            campaignLeadId: cl.id,
            lead: {
                id: cl.lead.id,
                firstName: cl.lead.firstName,
                lastName: cl.lead.lastName,
                linkedinUrl: cl.lead.linkedinUrl,
            },
            status: cl.status,
            currentStepId: cl.currentStepId,
            nextActionDate: cl.nextActionDate,
            isCompleted: cl.isCompleted,
            personalization: cl.personalization,
            recentLogs: logsMap[cl.leadId] || []
        }));

        // Calculate stats for this specific campaign
        const stats = {
            total: campaign.leads.length,
            pending: campaign.leads.filter(l => l.status === 'PENDING').length,
            connected: campaign.leads.filter(l => l.status === 'CONNECTED' || l.status === 'REPLIED').length,
            replied: campaign.leads.filter(l => l.status === 'REPLIED').length,
        };

        res.json({
            campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
            stats,
            leads: leadsWithLogs,
        });
    } catch (error) {
        console.error('Campaign status error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign status' });
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
