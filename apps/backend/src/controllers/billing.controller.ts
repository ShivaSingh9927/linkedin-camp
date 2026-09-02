import { Request, Response } from 'express';
import { prisma } from '@repo/db';
import { ACTIVE_PLANS, planFor, razorpayPlanId, type BillingCycle } from '../config/plans';
import {
    razorpayConfigured,
    razorpayKeyId,
    createCustomer,
    createSubscription,
    mapSubscriptionStatus,
} from '../services/razorpay.service';

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
