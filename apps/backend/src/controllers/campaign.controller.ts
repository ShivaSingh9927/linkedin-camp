import { Response } from 'express';
import { prisma } from '../server';

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
    const { leadIds } = req.body;

    try {
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

        if (startNode && leadIds && leadIds.length > 0) {
            // Find the immediate next node after trigger
            const firstEdge = workflow.edges?.find((e: any) => e.source === startNode.id);
            const firstStepId = firstEdge ? firstEdge.target : startNode.id;

            await prisma.campaignLead.createMany({
                data: leadIds.map((leadId: string) => ({
                    campaignId: id,
                    leadId,
                    currentStepId: firstStepId,
                    nextActionDate: new Date(),
                })),
                skipDuplicates: true,
            });
        }

        res.json(updatedCampaign);
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
