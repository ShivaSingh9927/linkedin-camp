import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '@repo/db';
import type { CrmEventPayload, CrmEventType } from './crm-events';

// The events a user can subscribe an outbound webhook to (same set the engine
// emits via emitCrmEvent).
export const WEBHOOK_EVENTS: CrmEventType[] = [
    'lead.added', 'lead.connected', 'lead.messaged', 'lead.replied', 'lead.bounced', 'lead.completed',
];

export function isValidWebhookEvent(e: string): e is CrmEventType {
    return (WEBHOOK_EVENTS as string[]).includes(e);
}

export function generateWebhookSecret(): string {
    return 'whsec_' + crypto.randomBytes(24).toString('hex');
}

function sign(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// Build the JSON body delivered to subscribers. Stable shape so integrations can
// rely on it: { id, event, occurredAt, data:{ leadId, campaignId, lead, ...meta } }.
async function buildEventBody(event: CrmEventType, payload: CrmEventPayload) {
    const lead = await prisma.lead.findUnique({
        where: { id: payload.leadId },
        select: { id: true, firstName: true, lastName: true, company: true, jobTitle: true, linkedinUrl: true, email: true, status: true },
    }).catch(() => null);
    return {
        id: 'evt_' + crypto.randomBytes(12).toString('hex'),
        event,
        occurredAt: new Date().toISOString(),
        data: {
            leadId: payload.leadId,
            campaignId: payload.campaignId,
            lead,
            ...(payload.meta || {}),
        },
    };
}

async function postWithRetry(url: string, body: string, headers: Record<string, string>): Promise<void> {
    const attempts = 3;
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
        try {
            await axios.post(url, body, { headers, timeout: 8000, validateStatus: (s) => s >= 200 && s < 300 });
            return;
        } catch (e: any) {
            lastErr = e;
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
    }
    throw lastErr;
}

// Deliver one lifecycle event to every active subscription that wants it.
// Per-subscription best-effort: a failing endpoint is recorded (failureCount /
// lastError) but never throws, so one bad subscriber can't affect others or the
// calling job. No-op (one indexed query) when the user has no subscriptions.
export async function deliverWebhookEvent(payload: CrmEventPayload): Promise<void> {
    const subs = await prisma.webhookSubscription.findMany({
        where: { userId: payload.userId, active: true, events: { has: payload.event } },
    }).catch(() => []);
    if (!subs.length) return;

    const bodyObj = await buildEventBody(payload.event, payload);
    for (const sub of subs) {
        const body = JSON.stringify(bodyObj);
        const headers = {
            'Content-Type': 'application/json',
            'X-Qampi-Event': payload.event,
            'X-Qampi-Delivery': bodyObj.id,
            'X-Qampi-Signature': sign(sub.secret, body),
        };
        try {
            await postWithRetry(sub.url, body, headers);
            await prisma.webhookSubscription.update({
                where: { id: sub.id }, data: { lastDeliveryAt: new Date(), failureCount: 0, lastError: null },
            }).catch(() => {});
        } catch (e: any) {
            const msg = (e?.response ? `HTTP ${e.response.status}` : e?.message || 'delivery failed').slice(0, 300);
            console.error(`[WEBHOOK] delivery to ${sub.url} failed: ${msg}`);
            await prisma.webhookSubscription.update({
                where: { id: sub.id }, data: { failureCount: { increment: 1 }, lastError: msg },
            }).catch(() => {});
        }
    }
}

// Send a sample event to one subscription so integrators can verify their setup.
export async function deliverTestEvent(subId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
    const sub = await prisma.webhookSubscription.findFirst({ where: { id: subId, userId } });
    if (!sub) return { ok: false, error: 'not_found' };
    const bodyObj = {
        id: 'evt_test_' + crypto.randomBytes(8).toString('hex'),
        event: 'ping',
        occurredAt: new Date().toISOString(),
        data: { message: 'This is a test event from Qampi.' },
    };
    const body = JSON.stringify(bodyObj);
    const headers = {
        'Content-Type': 'application/json',
        'X-Qampi-Event': 'ping',
        'X-Qampi-Delivery': bodyObj.id,
        'X-Qampi-Signature': sign(sub.secret, body),
    };
    try {
        await postWithRetry(sub.url, body, headers);
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: (e?.response ? `HTTP ${e.response.status}` : e?.message || 'delivery failed').slice(0, 300) };
    }
}
