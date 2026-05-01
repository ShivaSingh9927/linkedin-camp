import { Response } from 'express';
import { prisma } from '@repo/db';
import { getOrAssignProxy } from '../services/proxy.service';
import { enqueueCampaign } from '../workers/campaign-worker';

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
                        const leadIdRecord = await prisma.campaignLead.findUnique({
                            where: { campaignId_leadId: { campaignId: id, leadId } }
                        });
                        
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

        // Fetch all relevant action logs for these leads
        const leadIds = campaign.leads.map(cl => cl.leadId);
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

        const leadsWithLogs = campaign.leads.map(cl => ({
            campaignLeadId: cl.id,
            lead: {
                id: cl.lead.id,
                firstName: cl.lead.firstName || '',
                lastName: cl.lead.lastName || '',
                linkedinUrl: cl.lead.linkedinUrl,
                status: cl.lead.status || 'UNCONNECTED',
                company: cl.lead.company,
                jobTitle: cl.lead.jobTitle,
                aboutInfo: cl.lead.aboutInfo,
            },
            status: cl.lead.status || 'UNCONNECTED',
            currentStepId: cl.currentStepId || '',
            nextActionDate: cl.nextActionDate,
            isCompleted: cl.isCompleted || false,
            // Include full execution log from personalization
            execLog: (cl as any).personalization?.execLog || [],
            // Include extracted data
            nodeOutputs: (cl as any).personalization?.nodeOutputs || {},
            personalization: (cl as any).personalization?.nodeOutputs?.['send-message']?.messageText || 
                            (typeof (cl as any).personalization === 'string' ? (cl as any).personalization : ''),
            recentLogs: logsMap[cl.leadId] || []
        }));

        // Calculate stats for this specific campaign using lead status
        const stats = {
            total: campaign.leads.length,
            pending: campaign.leads.filter(l => l.lead.status === 'IMPORTED' || l.lead.status === 'PENDING').length,
            connected: campaign.leads.filter(l => l.lead.status === 'CONNECTED' || l.lead.status === 'REPLIED').length,
            replied: campaign.leads.filter(l => l.lead.status === 'REPLIED').length,
            // Calculate from execLog
            completed: campaign.leads.filter(l => l.isCompleted).length,
            failed: campaign.leads.filter(l => {
                const pl = l as any;
                return pl.personalization?.execLog?.some((e: any) => e.status === 'failed');
            }).length,
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

// ---- Export Campaign Data ----
export const exportCampaign = async (req: any, res: Response) => {
    const { id: campaignId } = req.params;
    const { format = 'json' } = req.query; // json or csv
    const userId = req.user.id;

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId, userId },
            include: {
                leads: {
                    include: { lead: true }
                }
            }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Build export data
        const exportData = campaign.leads.map(cl => {
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
                firstName: cl.lead.firstName,
                lastName: cl.lead.lastName,
                email: cl.lead.email || pv.email,
                linkedinUrl: cl.lead.linkedinUrl,
                
                // Enrichment
                company: cl.lead.company || pv.company,
                jobTitle: cl.lead.jobTitle || pv.jobTitle,
                about: cl.lead.aboutInfo || pv.about,
                
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
