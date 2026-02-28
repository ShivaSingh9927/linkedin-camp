import { Request, Response } from 'express';
import { prisma } from '../server';

export const getStats = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const [totalLeads, activeCampaigns, successfulActions, recentLogs] = await Promise.all([
            prisma.lead.count({ where: { userId } }),
            prisma.campaign.count({ where: { userId, status: 'ACTIVE' } }),
            prisma.actionLog.count({ where: { userId, status: 'SUCCESS' } }),
            prisma.actionLog.findMany({
                where: { userId },
                orderBy: { executedAt: 'desc' },
                take: 5,
                include: { lead: true }
            })
        ]);

        res.json({
            totalLeads,
            activeCampaigns,
            successfulActions,
            recentLogs
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
