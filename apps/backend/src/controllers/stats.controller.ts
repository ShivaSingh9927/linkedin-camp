import { Request, Response } from 'express';
import { prisma } from '../server';

export const getStats = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const [
            totalLeads,
            activeCampaigns,
            successfulActions,
            recentLogs,
            invitesSent,
            messagesSent,
            connectedLeads,
            campaigns
        ] = await Promise.all([
            prisma.lead.count({ where: { userId } }),
            prisma.campaign.count({ where: { userId, status: 'ACTIVE' } }),
            prisma.actionLog.count({ where: { userId, status: 'SUCCESS' } }),
            prisma.actionLog.findMany({
                where: { userId },
                orderBy: { executedAt: 'desc' },
                take: 8,
                include: { lead: true }
            }),
            prisma.actionLog.count({ where: { userId, actionType: 'INVITE', status: 'SUCCESS' } }),
            prisma.actionLog.count({ where: { userId, actionType: 'MESSAGE', status: 'SUCCESS' } }),
            prisma.lead.count({ where: { userId, status: { in: ['CONNECTED', 'REPLIED'] } } }),
            prisma.campaign.findMany({
                where: { userId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    _count: {
                        select: {
                            leads: true,
                            actionLogs: { where: { status: 'SUCCESS' } }
                        }
                    }
                }
            })
        ]);

        // Calculate 7-day activity
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activityRaw = await prisma.actionLog.findMany({
            where: {
                userId,
                executedAt: { gte: sevenDaysAgo },
                status: 'SUCCESS'
            },
            select: { executedAt: true }
        });

        const activityMap: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            activityMap[d.toISOString().split('T')[0]] = 0;
        }

        activityRaw.forEach(log => {
            const date = log.executedAt.toISOString().split('T')[0];
            if (activityMap[date] !== undefined) {
                activityMap[date]++;
            }
        });

        const chartData = Object.entries(activityMap)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            totalLeads,
            activeCampaigns,
            successfulActions,
            recentLogs,
            invitesSent,
            messagesSent,
            connectedLeads,
            chartData,
            campaignPerformance: campaigns.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                leads: c._count.leads,
                actions: c._count.actionLogs
            }))
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
