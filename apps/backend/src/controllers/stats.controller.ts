import { Request, Response } from 'express';
import { prisma } from '@repo/db';

export const getStats = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
            totalLeads,
            activeCampaignsCount,
            campaignsData,
            recentLogs,
            globalInvites,
            globalMessages,
            globalConnected,
            todayInvites,
            todayMessages,
            todayVisits
        ] = await Promise.all([
            prisma.lead.count({ where: { userId } }),
            prisma.campaign.count({ where: { userId, status: 'ACTIVE' } }),
            prisma.campaign.findMany({
                where: { userId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    leads: {
                        select: {
                            status: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.actionLog.findMany({
                where: { userId },
                orderBy: { executedAt: 'desc' },
                take: 10,
                include: { lead: true }
            }),
            prisma.actionLog.count({ where: { userId, actionType: 'INVITE', status: 'SUCCESS' } }),
            prisma.actionLog.count({ where: { userId, actionType: 'MESSAGE', status: 'SUCCESS' } }),
            prisma.lead.count({ where: { userId, status: { in: ['CONNECTED', 'REPLIED'] } } }),
            prisma.actionLog.count({ where: { userId, actionType: 'INVITE', executedAt: { gte: startOfToday } } }),
            prisma.actionLog.count({ where: { userId, actionType: 'MESSAGE', executedAt: { gte: startOfToday } } }),
            prisma.actionLog.count({ where: { userId, actionType: 'VISIT', executedAt: { gte: startOfToday } } })
        ]);

        // Process Campaign Stats
        const campaignPerformance = campaignsData.map(camp => {
            const leads = camp.leads;
            return {
                id: camp.id,
                name: camp.name,
                status: camp.status,
                totalLeads: leads.length,
                pending: leads.filter(l => l.status === 'PENDING').length,
                connected: leads.filter(l => l.status === 'CONNECTED' || l.status === 'REPLIED').length,
                replied: leads.filter(l => l.status === 'REPLIED').length
            };
        });

        // 7-day activity calculation (re-using existing logic but optimized)
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

        const totalReplies = await prisma.lead.count({ where: { userId, status: 'REPLIED' } });
        const totalSent = globalInvites + globalMessages;

        res.json({
            global: {
                totalLeads,
                activeCampaigns: activeCampaignsCount,
                sentRequests: totalSent,
                connectedLeads: globalConnected,
                replyRate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0,
                dailyRemaining: 80, // Legacy
                today: {
                    invites: todayInvites,
                    messages: todayMessages,
                    visits: todayVisits
                }
            },
            campaignPerformance,
            recentLogs,
            chartData
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
