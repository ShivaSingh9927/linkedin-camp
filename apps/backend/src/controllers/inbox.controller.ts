import { Response } from 'express';
import { prisma } from '@repo/db';
import { syncInbox } from '../workers/inbox.worker';

// ─── CONVERSATIONS (grouped messages by lead) ───

export const getConversations = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        // Get all leads that have at least one message
        const leadsWithMessages = await prisma.lead.findMany({
            where: {
                userId,
                messages: { some: {} },
            },
            include: {
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1, // latest message for preview
                },
                campaignLeads: {
                    include: {
                        campaign: { select: { id: true, name: true, status: true } },
                    },
                },
                _count: {
                    select: { messages: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        const conversations = leadsWithMessages.map((lead) => ({
            leadId: lead.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            jobTitle: lead.jobTitle,
            company: lead.company,
            linkedinUrl: lead.linkedinUrl,
            country: lead.country,
            gender: lead.gender,
            status: lead.status,
            tags: lead.tags,
            lastMessage: lead.messages[0] || null,
            messageCount: lead._count.messages,
            campaigns: lead.campaignLeads.map((cl) => cl.campaign),
        }));

        res.json(conversations);
    } catch (error) {
        console.error('Failed to fetch conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

// ─── MESSAGES FOR A SPECIFIC LEAD ───

export const getMessages = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { leadId } = req.params;

    try {
        const messages = await prisma.message.findMany({
            where: { userId, leadId },
            orderBy: { sentAt: 'asc' },
        });

        // Also get lead info
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, userId },
            include: {
                campaignLeads: {
                    include: {
                        campaign: { select: { id: true, name: true, status: true } },
                    },
                },
            },
        });

        res.json({ lead, messages });
    } catch (error) {
        console.error('Failed to fetch messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// ─── SEND / LOG A MESSAGE ───

export const sendMessage = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { leadId } = req.params;
    const { content, source, campaignId, templateId, direction } = req.body;

    if (!content || !leadId) {
        return res.status(400).json({ error: 'Content and leadId are required' });
    }

    try {
        const message = await prisma.message.create({
            data: {
                userId,
                leadId,
                direction: direction || 'SENT',
                content,
                source: source || 'MANUAL',
                campaignId: campaignId || null,
                templateId: templateId || null,
                sentAt: new Date(),
            },
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// ─── BULK LOG MESSAGES (for extension/campaign use) ───

export const bulkLogMessages = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array required' });
    }

    try {
        const result = await prisma.message.createMany({
            data: messages.map((msg: any) => ({
                userId,
                leadId: msg.leadId,
                direction: msg.direction || 'SENT',
                content: msg.content,
                source: msg.source || 'CAMPAIGN',
                campaignId: msg.campaignId || null,
                templateId: msg.templateId || null,
                sentAt: msg.sentAt ? new Date(msg.sentAt) : new Date(),
            })),
        });

        res.status(201).json({ success: true, count: result.count });
    } catch (error) {
        console.error('Failed to bulk log messages:', error);
        res.status(500).json({ error: 'Failed to log messages' });
    }
};

// ─── MESSAGE TEMPLATES ───

export const getTemplates = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const templates = await prisma.messageTemplate.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(templates);
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

export const createTemplate = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { name, content, variables, category } = req.body;

    if (!name || !content) {
        return res.status(400).json({ error: 'Name and content are required' });
    }

    // Auto-detect variables from {{variableName}} patterns
    const detectedVars = (content.match(/\{\{(\w+)\}\}/g) || []).map(
        (v: string) => v.replace(/\{\{|\}\}/g, '')
    );
    const allVars = [...new Set([...(variables || []), ...detectedVars])];

    try {
        const template = await prisma.messageTemplate.create({
            data: {
                userId,
                name,
                content,
                variables: allVars,
                category: category || null,
            },
        });
        res.status(201).json(template);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Template name already exists' });
        }
        console.error('Failed to create template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
};

export const updateTemplate = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, content, variables, category } = req.body;

    try {
        // Auto-detect variables if content changed
        let allVars = variables;
        if (content) {
            const detectedVars = (content.match(/\{\{(\w+)\}\}/g) || []).map(
                (v: string) => v.replace(/\{\{|\}\}/g, '')
            );
            allVars = [...new Set([...(variables || []), ...detectedVars])];
        }

        const template = await prisma.messageTemplate.update({
            where: { id, userId },
            data: {
                ...(name && { name }),
                ...(content && { content }),
                ...(allVars && { variables: allVars }),
                ...(category !== undefined && { category }),
            },
        });
        res.json(template);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Template name already exists' });
        }
        console.error('Failed to update template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
};

export const deleteTemplate = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        await prisma.messageTemplate.delete({
            where: { id, userId },
        });
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
};

// ─── NOTIFICATIONS ───

export const getNotifications = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });
        res.json(notifications);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const markNotificationsRead = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { ids } = req.body; // optional: specific IDs to mark read

    try {
        if (ids && Array.isArray(ids)) {
            await prisma.notification.updateMany({
                where: { userId, id: { in: ids } },
                data: { read: true },
            });
        } else {
            // Mark all read
            await prisma.notification.updateMany({
                where: { userId, read: false },
                data: { read: true },
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to mark notifications read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

export const syncInboxManual = async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const now = new Date();
        const lastAction = user.lastCloudActionAt ? user.lastCloudActionAt.getTime() : 0;
        const isRecentlyActive = (now.getTime() - lastAction) < (5 * 60 * 1000); // 5 minutes

        if (user.cloudWorkerActive || isRecentlyActive) {
            return res.status(409).json({ error: 'Cloud worker is currently active with another task (Campaign/Sync). Please try again in a few minutes.' });
        }

        // Run in background
        syncInbox(userId).catch(err => console.error('Manual sync failed:', err));
        res.json({ message: 'Sync started in background' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start sync' });
    }
};
