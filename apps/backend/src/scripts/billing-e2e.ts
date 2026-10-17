// End-to-end test of the billing lifecycle against Razorpay TEST mode and a
// throwaway database. Exercises the real controller code (checkout, cancel,
// webhook, grace downgrade) with real Razorpay test subscriptions and signed
// webhook replays. Run LOCALLY only:
//
//   docker run -d --name qampi-billing-test -e POSTGRES_PASSWORD=test \
//     -e POSTGRES_DB=billing_test -p 55432:5432 postgres:16-alpine
//   (cd packages/db && DATABASE_URL=... npx prisma db push --skip-generate)
//   env $(cat billing-test.env) npx ts-node --transpile-only src/scripts/billing-e2e.ts phase1
//   → pay the printed subscription in Checkout with a test card
//   env $(cat billing-test.env) npx ts-node --transpile-only src/scripts/billing-e2e.ts phase2
//
// billing-test.env holds RAZORPAY_KEY_ID/SECRET (rzp_test_ only), a random
// RAZORPAY_WEBHOOK_SECRET, the six RAZORPAY_PLAN_* test plan ids and a
// DATABASE_URL whose database is named billing_test. It refuses anything else.
import crypto from 'crypto';

if (!/\/billing_test(\?|$)/.test(process.env.DATABASE_URL || '')) {
    console.error('Refusing to run: DATABASE_URL must point at the throwaway billing_test database.');
    process.exit(1);
}
if (!(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_')) {
    console.error('Refusing to run: RAZORPAY_KEY_ID must be a test-mode key (rzp_test_…).');
    process.exit(1);
}
// No real emails from the dunning paths.
for (const k of Object.keys(process.env)) if (/^(SMTP|MAIL|OUTLOOK|GMAIL)/.test(k)) delete process.env[k];

import { prisma } from '@repo/db';
import { getPlans, createCheckout, cancelBilling, razorpayWebhook } from '../controllers/billing.controller';
import { fetchSubscription, cancelSubscriptionNow } from '../services/razorpay.service';

const PAYER = 'billing-e2e-payer@example.test';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || detail === undefined ? '' : `  → ${JSON.stringify(detail)}`}`);
}

// Razorpay test mode rate-limits bursts ("Too many requests").
const pace = () => new Promise((r) => setTimeout(r, 2500));

async function call(handler: (req: any, res: any) => any, req: any): Promise<{ code: number; body: any }> {
    if (handler === createCheckout || handler === cancelBilling) await pace();
    return new Promise((resolve) => {
        let code = 200;
        const res: any = {
            status(c: number) { code = c; return res; },
            json(body: any) { resolve({ code, body }); return res; },
        };
        Promise.resolve(handler(req, res)).catch((e) => resolve({ code: 599, body: String(e) }));
    });
}

const asUser = (id: string, body: any = {}) => ({ user: { id }, body, headers: {} });

// A webhook exactly as Razorpay sends it: JSON body, HMAC over the raw bytes.
function webhook(type: string, entity: any, eventId = `evt_${crypto.randomBytes(8).toString('hex')}`, secret = process.env.RAZORPAY_WEBHOOK_SECRET!) {
    const raw = Buffer.from(JSON.stringify({ event: type, payload: { subscription: { entity } } }));
    return {
        eventId,
        req: {
            rawBody: raw,
            headers: {
                'x-razorpay-signature': crypto.createHmac('sha256', secret).update(raw).digest('hex'),
                'x-razorpay-event-id': eventId,
            },
        },
    };
}

async function user(email: string) {
    return prisma.user.upsert({ where: { email }, create: { email, firstName: 'E2E' }, update: {} });
}
const sub = (userId: string) => prisma.subscription.findUnique({ where: { userId } });
const tierOf = async (userId: string) => (await prisma.user.findUnique({ where: { id: userId } }))!.tier;

async function phase1() {
    console.log('\n[1] Plans');
    const plans = await call(getPlans, {});
    check('every paid plan is available for checkout', plans.body.plans.every((p: any) => p.available), plans.body.plans.map((p: any) => [p.key, p.available]));
    check('checkout currency is INR only', JSON.stringify(plans.body.currency.checkout) === '["inr"]', plans.body.currency);

    console.log('\n[2] Checkout + abandoned checkout');
    const u = await user(PAYER);
    const first = await call(createCheckout, asUser(u.id, { tier: 'CORE', cycle: 'MONTHLY' }));
    check('first checkout returns a subscription', first.code === 200 && !!first.body.subscriptionId, first);
    const a = await sub(u.id);
    check('local row is TRIALING (unpaid), tier not granted', a?.status === 'TRIALING' && (await tierOf(u.id)) === 'FREE', a);

    const second = await call(createCheckout, asUser(u.id, { tier: 'CORE', cycle: 'MONTHLY' }));
    check('second checkout (abandoned first) succeeds', second.code === 200 && second.body.subscriptionId !== first.body.subscriptionId, second);
    const remoteA = await fetchSubscription(first.body.subscriptionId);
    check('abandoned subscription was cancelled at Razorpay', remoteA?.status === 'cancelled', remoteA);
    check('local row now tracks the new subscription', (await sub(u.id))?.providerSubId === second.body.subscriptionId);

    console.log('\n[3] Webhook from the superseded subscription');
    const sup = webhook('subscription.cancelled', { id: first.body.subscriptionId, status: 'cancelled', notes: { userId: u.id, tier: 'CORE' } });
    const supRes = await call(razorpayWebhook, sup.req);
    check('accepted (200)', supRes.code === 200, supRes);
    check('ignored: row still on the new subscription', (await sub(u.id))?.providerSubId === second.body.subscriptionId);

    console.log('\n[4] Signature');
    const forged = webhook('subscription.activated', { id: second.body.subscriptionId, status: 'active' }, undefined, 'wrong-secret');
    check('forged signature rejected (401)', (await call(razorpayWebhook, forged.req)).code === 401);

    console.log(`\nPAY THIS: key=${first.body.keyId} subscription=${second.body.subscriptionId}`);
}

async function phase2() {
    const u = await user(PAYER);
    const s0 = (await sub(u.id))!;
    const subId = s0.providerSubId!;
    const remote = await fetchSubscription(subId);
    console.log(`\n[5] After payment: Razorpay says ${remote?.status}, paid_count ${remote?.paid_count}`);
    if (remote?.status !== 'active') { console.error('Subscription is not active — pay it first.'); process.exit(1); }

    console.log('\n[6] Webhooks out of order');
    const base = { id: subId, customer_id: remote.customer_id, notes: { userId: u.id, tier: 'CORE' } };
    await call(razorpayWebhook, webhook('subscription.charged', { ...base, status: 'active' }).req);
    await call(razorpayWebhook, webhook('subscription.activated', { ...base, status: 'active' }).req);
    check('activated → ACTIVE, tier CORE', (await sub(u.id))?.status === 'ACTIVE' && (await tierOf(u.id)) === 'CORE');
    await call(razorpayWebhook, webhook('subscription.authenticated', { ...base, status: 'authenticated' }).req);
    check('late "authenticated" does NOT regress to unpaid', (await sub(u.id))?.status === 'ACTIVE', await sub(u.id));
    check('customer id synced from Razorpay', (await sub(u.id))?.providerCustomerId === remote.customer_id
        && (await prisma.user.findUnique({ where: { id: u.id } }))?.razorpayCustomerId === remote.customer_id);
    check('period end recorded', !!(await sub(u.id))?.currentPeriodEnd);

    console.log('\n[7] Second checkout while paid');
    const again = await call(createCheckout, asUser(u.id, { tier: 'PRO', cycle: 'MONTHLY' }));
    check('blocked with 409 SUBSCRIPTION_EXISTS', again.code === 409 && again.body.code === 'SUBSCRIPTION_EXISTS', again);

    console.log('\n[8] Paid, but our row still says unpaid (webhook not landed yet)');
    await prisma.subscription.update({ where: { userId: u.id }, data: { status: 'TRIALING' } });
    const race = await call(createCheckout, asUser(u.id, { tier: 'CORE', cycle: 'MONTHLY' }));
    check('checkout refused (409), not a second charge', race.code === 409, race);
    check('paid subscription NOT cancelled at Razorpay', (await fetchSubscription(subId))?.status === 'active');
    check('local row corrected to ACTIVE', (await sub(u.id))?.status === 'ACTIVE');

    console.log('\n[9] Webhook apply failure → retried, not lost');
    const retry = webhook('subscription.charged', { ...base, status: 'active' });
    const goodSecret = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_SECRET = 'broken'; // Razorpay lookup fails (401)
    const failed = await call(razorpayWebhook, retry.req);
    process.env.RAZORPAY_KEY_SECRET = goodSecret;
    check('apply failure answers 500 so Razorpay retries', failed.code === 500, failed);
    check('failed event not left in the ledger', !(await prisma.webhookEvent.findUnique({ where: { eventId: retry.eventId } })));
    const retried = await call(razorpayWebhook, retry.req);
    check('retry is applied (200, not deduped)', retried.code === 200 && !retried.body.deduped, retried);
    const dup = await call(razorpayWebhook, retry.req);
    check('a duplicate after success is deduped', dup.body.deduped === true, dup);

    console.log('\n[10] Payment failure → dunning → grace downgrade (Razorpay cannot fail a renewal on demand, so the event is replayed)');
    const d = await user('billing-e2e-dunning@example.test');
    const dCheckout = await call(createCheckout, asUser(d.id, { tier: 'PRO', cycle: 'MONTHLY' }));
    const dSub = dCheckout.body.subscriptionId;
    // Pretend it was paid and a renewal then failed (the real subscription stays unpaid at Razorpay).
    await prisma.subscription.update({ where: { userId: d.id }, data: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 86400e3) } });
    await prisma.user.update({ where: { id: d.id }, data: { tier: 'PRO' } });
    const fakeId = `sub_E2E${crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 11)}`; // real format, unknown to Razorpay
    await prisma.subscription.update({ where: { userId: d.id }, data: { providerSubId: fakeId } });
    await call(razorpayWebhook, webhook('subscription.pending', { id: fakeId, status: 'pending', current_end: Math.floor(Date.now() / 1000) + 86400, notes: { userId: d.id, tier: 'PRO' } }).req);
    check('pending → PAST_DUE, tier kept for the grace window', (await sub(d.id))?.status === 'PAST_DUE' && (await tierOf(d.id)) === 'PRO');
    check('user notified about the failed payment', (await prisma.notification.count({ where: { userId: d.id, title: { contains: 'Payment issue' } } })) === 1);
    // Point it back at the real Razorpay subscription and expire the grace window.
    await prisma.subscription.update({ where: { userId: d.id }, data: { providerSubId: dSub, currentPeriodEnd: new Date(Date.now() - 60e3) } });
    const { runGraceDowngrade } = await import('../cron/scheduler');
    await runGraceDowngrade();
    check('grace job cancelled it at Razorpay', (await fetchSubscription(dSub))?.status === 'cancelled');
    check('grace job → CANCELED, tier FREE, user told', (await sub(d.id))?.status === 'CANCELED' && (await tierOf(d.id)) === 'FREE'
        && (await prisma.notification.count({ where: { userId: d.id, title: 'Your plan has ended' } })) === 1);

    console.log('\n[11] Cancelling a past-due plan ends it now');
    const p = await user('billing-e2e-pastdue@example.test');
    const pCheckout = await call(createCheckout, asUser(p.id, { tier: 'BUSINESS', cycle: 'ANNUAL' }));
    await prisma.subscription.update({ where: { userId: p.id }, data: { status: 'PAST_DUE' } });
    const pc = await call(cancelBilling, asUser(p.id));
    check('cancel accepted, not deferred to period end', pc.code === 200 && pc.body.cancelAtPeriodEnd === false, pc);
    check('cancelled at Razorpay immediately', (await fetchSubscription(pCheckout.body.subscriptionId))?.status === 'cancelled');

    console.log('\n[12] Stale customer id (from the other mode)');
    const st = await user('billing-e2e-stale@example.test');
    await prisma.user.update({ where: { id: st.id }, data: { razorpayCustomerId: 'cust_E2Edoesnotexist' } });
    const stc = await call(createCheckout, asUser(st.id, { tier: 'CORE', cycle: 'ANNUAL' }));
    const stUser = await prisma.user.findUnique({ where: { id: st.id } });
    check('checkout works and the stale id is replaced', stc.code === 200 && stUser?.razorpayCustomerId !== 'cust_E2Edoesnotexist', stc);
    await cancelSubscriptionNow(stc.body.subscriptionId);

    console.log('\n[13] Cancelling the paid plan');
    const c = await call(cancelBilling, asUser(u.id));
    check('paid plan cancels at period end, access kept', c.code === 200 && c.body.cancelAtPeriodEnd === true
        && (await tierOf(u.id)) === 'CORE' && (await fetchSubscription(subId))?.status === 'active', c);
    const blocked = await call(createCheckout, asUser(u.id, { tier: 'PRO', cycle: 'MONTHLY' }));
    check('new checkout explains the plan runs until period end', blocked.code === 409 && /active until/.test(blocked.body.error), blocked);
    // Razorpay can't fast-forward to period end: end it now and replay the event it sends then.
    await cancelSubscriptionNow(subId);
    await call(razorpayWebhook, webhook('subscription.cancelled', { ...base, status: 'cancelled' }).req);
    check('subscription.cancelled → CANCELED, tier FREE', (await sub(u.id))?.status === 'CANCELED' && (await tierOf(u.id)) === 'FREE');
    const resub = await call(createCheckout, asUser(u.id, { tier: 'PRO', cycle: 'ANNUAL' }));
    check('can subscribe again after it ended', resub.code === 200 && !!resub.body.subscriptionId, resub);
    await cancelSubscriptionNow(resub.body.subscriptionId);
}

(async () => {
    const phase = process.argv[2];
    if (phase === 'phase1') await phase1();
    else if (phase === 'phase2') await phase2();
    else { console.error('usage: billing-e2e.ts phase1|phase2'); process.exit(2); }
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
    process.exit(failures ? 1 : 0);
})();
