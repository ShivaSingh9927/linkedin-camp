import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '@repo/db';
import { z } from 'zod';
import { enqueueCRMSync } from '../workers/crm.worker';

const router = Router();

const replyWebhookSchema = z.object({
    prospectId: z.string().optional(),
    linkedinUrl: z.string().optional(),
    newStatus: z.string()
}).refine(data => data.prospectId || data.linkedinUrl, {
    message: "Either prospectId or linkedinUrl must be provided",
    path: ["prospectId"]
});

router.use(authMiddleware);

router.post('/linkedin-reply', async (req: AuthRequest, res) => {
    try {
        console.log('[WEBHOOK-ROUTES] Received reply webhook:', req.body);

        // 1. Validate payload
        const parsed = replyWebhookSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.format() });
        }

        const { prospectId, linkedinUrl, newStatus } = parsed.data;
        const userId = req.user!.id;

        // 2. Locate the lead in the DB
        let lead = null;

        if (prospectId) {
            lead = await prisma.lead.findFirst({
                where: { id: prospectId, userId }
            });
        }

        if (!lead && linkedinUrl) {
            // Clean/normalize linkedinUrl before query (extract path up to username)
            const cleanUrl = linkedinUrl.split('?')[0].replace(/\/$/, '');
            lead = await prisma.lead.findFirst({
                where: {
                    userId,
                    linkedinUrl: {
                        contains: cleanUrl,
                        mode: 'insensitive'
                    }
                }
            });
        }

        if (!lead) {
            console.warn(`[WEBHOOK-ROUTES] Lead not found for prospectId: ${prospectId}, url: ${linkedinUrl}`);
            return res.status(404).json({ error: 'Lead not found' });
        }

        console.log(`[WEBHOOK-ROUTES] Found lead ${lead.id} (${lead.firstName} ${lead.lastName}). Status from request: ${newStatus}`);

        // 3. Update lead and campaignLead status if status is REPLIED or updated
        if (newStatus === 'REPLIED') {
            await prisma.lead.update({
                where: { id: lead.id },
                data: { status: 'REPLIED' }
            });

            await prisma.campaignLead.updateMany({
                where: { leadId: lead.id, isCompleted: false },
                data: { status: 'REPLIED' }
            });

            // CRM event — emit per active campaign link.
            const activeLinks = await prisma.campaignLead.findMany({
                where: { leadId: lead.id, isCompleted: false },
                select: { campaignId: true },
            });
            for (const link of activeLinks) {
                import('../services/crm-events').then(({ emitCrmEvent }) =>
                    emitCrmEvent({
                        event: 'lead.replied',
                        userId,
                        campaignId: link.campaignId,
                        leadId: lead.id,
                        meta: { source: 'webhook' },
                    }),
                ).catch(() => {});
            }

            // Create notification if not already done
            await prisma.notification.create({
                data: {
                    userId,
                    title: 'New Reply Received',
                    body: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() + ' messaged you back.',
                    type: 'REPLY',
                    meta: { leadId: lead.id }
                }
            }).catch(() => {});
        }

        // 4. Enqueue BullMQ job to sync to CRM
        await enqueueCRMSync(userId, lead.id);

        res.status(202).json({
            success: true,
            message: 'CRM synchronization enqueued successfully',
            leadId: lead.id
        });
    } catch (err: any) {
        console.error('[WEBHOOK-ROUTES] Webhook execution error:', err.message);
        res.status(500).json({ error: 'Internal server error processing webhook' });
    }
});

export default router;
