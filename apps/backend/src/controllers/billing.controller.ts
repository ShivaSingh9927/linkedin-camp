import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@repo/db';
import { ACTIVE_PLANS, planFor, razorpayPlanId, type BillingCycle } from '../config/plans';
import {
    razorpayConfigured,
    razorpayKeyId,
    createCustomer,
    createSubscription,
    cancelSubscription,
    mapSubscriptionStatus,
} from '../services/razorpay.service';
import { mailService } from '../services/mail.service';

// GET /api/v1/billing/plans
// The pricing page renders entirely from this, so plans live in ONE place
// (config/plans). `available` tells the UI whether checkout is wired for each
// tier×cycle (i.e. the Razorpay plan id + keys are configured in this env).
export async function getPlans(_req: Request, res: Response) {
    const configured = razorpayConfigured();
    const plans = ACTIVE_PLANS.map((p) => ({
        key: p.key,
        label: p.label,
        pricing: p.pricing,
        monthlyInvites: p.monthlyInvites,
        leadsStored: p.leadsStored,
        emailFinderCredits: p.emailFinderCredits,
        emailFinderRecurring: p.emailFinderRecurring,
        features: p.features,
        supportSla: p.supportSla,
        available:
            p.key === 'FREE' ||
            (configured &&
                !!razorpayPlanId(p.key, 'MONTHLY') &&
                !!razorpayPlanId(p.key, 'ANNUAL')),
    }));
    res.json({ plans, currency: { primary: 'inr' }, configured });
}

// POST /api/v1/billing/checkout   body: { tier, cycle }
// Creates a Razorpay subscription and records a local Subscription row. Does NOT
// grant the tier — User.tier is only ever written by the Phase 3 webhook once
// payment actually succeeds. Returns what the browser Checkout needs.
export async function createCheckout(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tier = String(req.body?.tier || '').toUpperCase();
    const cycle = String(req.body?.cycle || '').toUpperCase() as BillingCycle;

    if (cycle !== 'MONTHLY' && cycle !== 'ANNUAL') {
        return res.status(400).json({ error: 'cycle must be MONTHLY or ANNUAL' });
    }
    const plan = planFor(tier);
    if (plan.key === 'FREE') {
        return res.status(400).json({ error: 'Free plan needs no checkout' });
    }
    if (!razorpayConfigured()) {
        return res.status(503).json({ error: 'Billing is not configured yet' });
    }
    const planId = razorpayPlanId(plan.key, cycle);
    if (!planId) {
        return res.status(400).json({ error: `No Razorpay plan configured for ${plan.label} ${cycle}` });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true, razorpayCustomerId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
        // Ensure a Razorpay customer (reused across resubscribes / billing portal).
        let customerId = user.razorpayCustomerId || undefined;
        if (!customerId) {
            const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
            const customer = await createCustomer(name, user.email);
            customerId = customer.id;
            await prisma.user.update({ where: { id: userId }, data: { razorpayCustomerId: customerId } }).catch(() => {});
        }

        const sub = await createSubscription({
            planId,
            cycle,
            customerId,
            notes: { userId, tier: plan.key, cycle },
        });

        // Record/refresh the local subscription (userId is unique — one billing
        // owner). Status reflects Razorpay's initial state; the webhook advances
        // it and flips User.tier on the first successful charge.
        await prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                provider: 'razorpay',
                providerCustomerId: customerId,
                providerSubId: sub.id,
                tier: plan.key,
                cycle,
                status: mapSubscriptionStatus(sub.status),
            },
            update: {
                providerCustomerId: customerId,
                providerSubId: sub.id,
                tier: plan.key,
                cycle,
                status: mapSubscriptionStatus(sub.status),
                cancelAtPeriodEnd: false,
            },
        });

        return res.json({
            keyId: razorpayKeyId(),
            subscriptionId: sub.id,
            shortUrl: sub.short_url,
            tier: plan.key,
            cycle,
        });
    } catch (err: any) {
        const detail = err?.response?.data?.error?.description || err?.message || 'checkout failed';
        console.error('[BILLING] checkout error:', detail);
        return res.status(502).json({ error: `Could not start checkout: ${detail}` });
    }
}

// GET /api/v1/billing/subscription — the current plan for the settings/billing UI.
export async function getSubscription(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sub = await prisma.subscription.findUnique({ where: { userId } }).catch(() => null);
    if (!sub) return res.json({ subscription: null, tier: 'FREE', label: 'Free' });

    return res.json({
        subscription: {
            tier: sub.tier,
            label: planFor(sub.tier).label,
            status: sub.status,
            cycle: sub.cycle,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        },
    });
}

// POST /api/v1/billing/cancel — cancel at the end of the paid period (access
// kept until then). The webhook's subscription.cancelled revokes the tier.
export async function cancelBilling(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sub = await prisma.subscription.findUnique({ where: { userId } }).catch(() => null);
    if (!sub || !sub.providerSubId) return res.status(400).json({ error: 'No active subscription' });
    if (sub.status === 'CANCELED') return res.json({ ok: true, alreadyCanceled: true });

    try {
        await cancelSubscription(sub.providerSubId, true);
        await prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: true } });
        return res.json({ ok: true, cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd });
    } catch (err: any) {
        const detail = err?.response?.data?.error?.description || err?.message || 'cancel failed';
        console.error('[BILLING] cancel error:', detail);
        return res.status(502).json({ error: `Could not cancel: ${detail}` });
    }
}

// POST /api/webhooks/razorpay  (NO auth — called by Razorpay servers)
// The ONLY writer of User.tier. Verifies the HMAC signature over the raw body,
// dedupes via the WebhookEvent ledger, then advances the local Subscription and
// grants/revokes the tier. Always 200s after a valid signature so Razorpay
// doesn't retry-storm on an app-side bug — the event is recorded for replay.
export async function razorpayWebhook(req: any, res: Response) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'webhook not configured' });

    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const raw: Buffer | undefined = req.rawBody;
    if (!signature || !raw) return res.status(400).json({ error: 'missing signature or body' });

    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        console.warn('[BILLING] webhook signature mismatch');
        return res.status(401).json({ error: 'invalid signature' });
    }

    let event: any;
    try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'bad json' }); }

    // Idempotency: Razorpay's event id (header), else a hash of the body.
    const eventId = (req.headers['x-razorpay-event-id'] as string) || crypto.createHash('sha256').update(raw).digest('hex');
    try {
        await prisma.webhookEvent.create({
            data: { provider: 'razorpay', eventId, eventType: event?.event || 'unknown', payload: event },
        });
    } catch (e: any) {
        if (e?.code === 'P2002') return res.status(200).json({ ok: true, deduped: true });
        console.error('[BILLING] webhook ledger write failed:', e?.message);
    }

    try {
        await applyRazorpayEvent(event);
    } catch (e: any) {
        console.error('[BILLING] webhook apply error:', e?.message);
    }
    return res.status(200).json({ ok: true });
}

// Advance local state from a verified Razorpay event. Subscription lifecycle +
// payment failure only; everything else is recorded (ledger) and ignored.
async function applyRazorpayEvent(event: any): Promise<void> {
    const type: string = event?.event || '';
    const entity = event?.payload?.subscription?.entity;

    if (type.startsWith('subscription.') && entity) {
        const subId: string = entity.id;
        const mapped = mapSubscriptionStatus(entity.status);
        const currentEnd = entity.current_end ? new Date(entity.current_end * 1000) : null;

        const local = await prisma.subscription.findUnique({ where: { providerSubId: subId } });
        const userId: string | undefined = local?.userId || entity?.notes?.userId;
        if (!userId) { console.warn(`[BILLING] webhook: no user for subscription ${subId}`); return; }

        // Type-safe tier resolution (planFor maps unknown → FREE).
        const tier = planFor(local?.tier ?? entity?.notes?.tier).key;
        const cancelled = type === 'subscription.cancelled';

        await prisma.subscription.upsert({
            where: { userId },
            create: {
                userId, provider: 'razorpay', providerSubId: subId, tier,
                status: mapped, currentPeriodEnd: currentEnd, cancelAtPeriodEnd: cancelled,
            },
            update: {
                providerSubId: subId, status: mapped, currentPeriodEnd: currentEnd,
                ...(cancelled ? { cancelAtPeriodEnd: true } : {}),
            },
        });

        // The single write of User.tier: grant on active, revoke on terminal.
        // PAST_DUE / PAUSED / TRIALING keep the current tier (grace window) —
        // Phase 5 dunning refines the downgrade timing.
        if (mapped === 'ACTIVE') {
            await prisma.user.update({ where: { id: userId }, data: { tier } });
        } else if (mapped === 'CANCELED') {
            await prisma.user.update({ where: { id: userId }, data: { tier: 'FREE' } });
        }

        // Dunning: a charge failed (pending = will retry, halted = retries
        // exhausted). Keep the tier for the grace window (until currentPeriodEnd;
        // the grace cron downgrades after that) but nudge the user to fix payment.
        if (type === 'subscription.pending' || type === 'subscription.halted') {
            await notifyPaymentIssue(userId);
        }
        return;
    }

    // payment.failed carries no subscription entity; the subscription.pending/
    // .halted events above are the ones we act on for dunning.
}

// In-app notification + email nudging the user to fix a failed payment.
async function notifyPaymentIssue(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
    }).catch(() => null);
    if (!user) return;

    await prisma.notification.create({
        data: {
            userId,
            type: 'INFO',
            title: 'Payment issue on your subscription',
            body: 'We couldn\'t collect your latest payment. Update your payment method to keep your plan active.',
        },
    }).catch(() => {});

    await mailService.sendPaymentFailedEmail(user.email, user.firstName || '').catch(() => {});
}
