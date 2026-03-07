import axios from 'axios';
import { prisma } from '@repo/db';

export const triggerWebhook = async (userId: string, event: string, payload: any) => {
    try {
        const integrations = await prisma.integration.findMany({
            where: {
                userId,
                isActive: true,
            }
        });

        if (integrations.length === 0) return;

        const data = {
            event,
            timestamp: new Date().toISOString(),
            data: payload
        };

        const promises = integrations.map(async (integration: any) => {
            try {
                await axios.post(integration.webhookUrl, data, {
                    timeout: 5000,
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log(`[Webhook] Sent ${event} to ${integration.provider}`);
            } catch (err: any) {
                console.error(`[Webhook Error] Failed to send ${event} to ${integration.provider}: ${err.message}`);
            }
        });

        await Promise.allSettled(promises);
    } catch (err: any) {
        console.error(`[Webhook Service Error] ${err.message}`);
    }
};
