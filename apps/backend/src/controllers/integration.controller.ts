import { Request, Response } from 'express';
import { prisma } from '@repo/db';

export const getIntegrations = async (req: Request, res: Response) => {
    try {
        const integrations = await prisma.integration.findMany({
            where: { userId: (req as any).user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(integrations);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createIntegration = async (req: Request, res: Response) => {
    try {
        const { provider, webhookUrl } = req.body;

        if (!provider || !webhookUrl) {
            return res.status(400).json({ error: 'Provider and Webhook URL are required' });
        }

        const integration = await prisma.integration.upsert({
            where: {
                userId_provider: {
                    userId: (req as any).user.id,
                    provider
                }
            },
            update: { webhookUrl, isActive: true },
            create: {
                userId: (req as any).user.id,
                provider,
                webhookUrl
            }
        });

        res.status(201).json(integration);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteIntegration = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.integration.delete({
            where: {
                id: id as string,
                userId: (req as any).user.id // Ensure they only delete their own
            }
        });

        res.json({ success: true });
    } catch (err: any) {
        if (err.code === 'P2025') { // Record not found
            return res.status(404).json({ error: 'Integration not found' });
        }
        res.status(500).json({ error: err.message });
    }
};
