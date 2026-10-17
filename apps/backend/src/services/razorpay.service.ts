// Razorpay REST client (Phase 2 — checkout). Uses axios + Basic auth so we add
// no new dependency and keep the same self-contained-HTTP style as the rest of
// the backend. Card data never touches our servers — the customer authorizes on
// Razorpay's hosted Checkout, and the SUBSCRIPTION is the object we track.
//
// Env (created in the Razorpay dashboard; placeholders are fine until live):
//   RAZORPAY_KEY_ID       — public key id (also handed to the browser Checkout)
//   RAZORPAY_KEY_SECRET   — secret, server-only
//   RAZORPAY_PLAN_<TIER>_<CYCLE> — plan ids, resolved in config/plans.ts
import axios from 'axios';
import { SubscriptionStatus } from '@prisma/client';
import type { BillingCycle } from '../config/plans';

const API_BASE = 'https://api.razorpay.com/v1';

export function razorpayConfigured(): boolean {
    return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId(): string {
    return process.env.RAZORPAY_KEY_ID || '';
}

function authHeader(): string {
    const raw = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
    return 'Basic ' + Buffer.from(raw).toString('base64');
}

const client = () =>
    axios.create({
        baseURL: API_BASE,
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        timeout: 15000,
    });

export interface RazorpayCustomer { id: string; }
export interface RazorpaySubscription { id: string; short_url: string; status: string; }

// Idempotent-ish: Razorpay errors if a customer with the same email exists and
// fail_existing isn't 0; we pass fail_existing:0 so it returns the existing one.
export async function createCustomer(name: string, email: string): Promise<RazorpayCustomer> {
    const { data } = await client().post('/customers', {
        name: name || email,
        email,
        fail_existing: 0,
    });
    return { id: data.id };
}

// The stored customer id may come from the other mode (test vs live keys),
// where it doesn't exist. Returns false only when Razorpay says so; any other
// error is thrown.
export async function customerExists(customerId: string): Promise<boolean> {
    try {
        await client().get(`/customers/${customerId}`);
        return true;
    } catch (err: any) {
        if (isNotFound(err)) return false;
        throw err;
    }
}

export interface RazorpaySubscriptionState {
    id: string;
    status: string;
    paid_count: number;
    current_end: number | null;
    customer_id: string | null;
}

// Razorpay's current view of a subscription. Webhooks can arrive out of order,
// so this — not the event payload — is the truth about where a subscription is.
// Null when these keys can't see it (e.g. it was created in the other mode).
export async function fetchSubscription(subId: string): Promise<RazorpaySubscriptionState | null> {
    try {
        const { data } = await client().get(`/subscriptions/${subId}`);
        return {
            id: data.id,
            status: data.status,
            paid_count: Number(data.paid_count) || 0,
            current_end: data.current_end ?? null,
            customer_id: data.customer_id ?? null,
        };
    } catch (err: any) {
        if (isNotFound(err)) return null;
        throw err;
    }
}

export function razorpayErrorDetail(err: any): string {
    return err?.response?.data?.error?.description || err?.message || '';
}

function isNotFound(err: any): boolean {
    return /could not be found|does not exist/i.test(razorpayErrorDetail(err));
}

// total_count is the max number of billing cycles Razorpay will run. We set a
// long horizon (renewals continue until cancelled); the value just bounds it.
const TOTAL_COUNT: Record<BillingCycle, number> = { MONTHLY: 120, ANNUAL: 10 };

export async function createSubscription(opts: {
    planId: string;
    cycle: BillingCycle;
    customerId?: string;
    notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
    const { data } = await client().post('/subscriptions', {
        plan_id: opts.planId,
        total_count: TOTAL_COUNT[opts.cycle],
        customer_notify: 1,
        ...(opts.customerId ? { customer_id: opts.customerId } : {}),
        notes: opts.notes || {},
    });
    return { id: data.id, short_url: data.short_url, status: data.status };
}

// Cancel a subscription. Default cancels at the end of the current billing
// cycle (the customer keeps access they've paid for); pass atCycleEnd=false for
// an immediate cancel. Razorpay emits subscription.cancelled, which the webhook
// turns into the tier revocation.
export async function cancelSubscription(subId: string, atCycleEnd = true): Promise<{ status: string }> {
    const { data } = await client().post(`/subscriptions/${subId}/cancel`, {
        cancel_at_cycle_end: atCycleEnd ? 1 : 0,
    });
    return { status: data.status };
}

// Cancel immediately, treating "already over" and "not visible to these keys"
// as done — both mean it can't charge this account. Throws on anything else.
export async function cancelSubscriptionNow(subId: string): Promise<void> {
    try {
        await cancelSubscription(subId, false);
    } catch (err: any) {
        if (!/cancel|expire|complete|could not be found|does not exist/i.test(razorpayErrorDetail(err))) throw err;
    }
}

// Razorpay subscription status → our normalized enum. Used at checkout (initial
// row) and by the Phase 3 webhook (state sync).
export function mapSubscriptionStatus(razorpayStatus: string): SubscriptionStatus {
    switch (razorpayStatus) {
        case 'active':
            return 'ACTIVE';
        case 'authenticated':
        case 'created':
            return 'TRIALING'; // awaiting first successful charge
        case 'pending':
        case 'halted':
            return 'PAST_DUE';
        case 'paused':
            return 'PAUSED';
        case 'cancelled':
        case 'completed':
        case 'expired':
            return 'CANCELED';
        default:
            return 'TRIALING';
    }
}
