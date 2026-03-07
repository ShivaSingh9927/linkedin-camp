import { Request, Response } from 'express';
import { prisma } from '@repo/db';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        // Assuming we have basic authentication middleware that attaches userId to req.user
        // For now, if no auth middleware is fully active, we might need userId in query or body
        // Let's assume you've implemented req.user or we can pass userId to fetch for testing
        const userIdStr = req.query.userId;
        const userId = Array.isArray(userIdStr) ? userIdStr[0] as string : userIdStr as string;

        if (!userId) {
            res.status(400).json({ success: false, error: 'userId is required' });
            return;
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20 // Limit to last 20 notifications
        });

        const unreadCount = notifications.filter(n => !n.read).length;

        res.json({
            success: true,
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('[Notifications] Error fetching notifications:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { notificationId } = req.params;
        const bodyUserId = req.body.userId; // Ideally from auth token
        const userId = Array.isArray(bodyUserId) ? bodyUserId[0] as string : bodyUserId as string;

        if (!userId) {
            res.status(400).json({ success: false, error: 'userId is required' });
            return;
        }

        const notification = await prisma.notification.findUnique({
            where: { id: notificationId as string }
        });

        if (!notification || notification.userId !== userId) {
            res.status(404).json({ success: false, error: 'Notification not found' });
            return;
        }

        await prisma.notification.update({
            where: { id: notificationId as string },
            data: { read: true }
        });

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('[Notifications] Error marking as read:', error);
        res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const bodyUserId = req.body.userId; // Ideally from auth token
        const userId = Array.isArray(bodyUserId) ? bodyUserId[0] as string : bodyUserId as string;

        if (!userId) {
            res.status(400).json({ success: false, error: 'userId is required' });
            return;
        }

        await prisma.notification.updateMany({
            where: {
                userId,
                read: false
            },
            data: { read: true }
        });

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('[Notifications] Error marking all as read:', error);
        res.status(500).json({ success: false, error: 'Failed to mark all as read' });
    }
};
