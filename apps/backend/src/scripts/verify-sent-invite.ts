/**
 * Live check for hasPendingSentInvite().
 *
 * The connect node now asks LinkedIn whether an invitation actually exists
 * instead of assuming a Send click worked. That check is deliberately
 * fail-safe (null → fall back to DOM), so a wrong endpoint degrades quietly
 * rather than mass-failing connects — which also means a silent regression
 * would be invisible. This script makes it visible.
 *
 * Usage (on the worker box):
 *   docker exec -e QCAP_EMAIL=you@example.com -e QCAP_VANITY=some-profile-slug \
 *     backend-worker node /app/apps/backend/dist/scripts/verify-sent-invite.js
 */
import { prisma } from '@repo/db';
import { hasPendingSentInvite } from '../services/voyager-api.service';

(async () => {
    const email = process.env.QCAP_EMAIL;
    const vanity = process.env.QCAP_VANITY;
    if (!email || !vanity) {
        console.error('Set QCAP_EMAIL and QCAP_VANITY');
        process.exit(2);
    }

    const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (!user) { console.error(`No user for ${email}`); process.exit(2); }

    const t0 = Date.now();
    const result = await hasPendingSentInvite(user.id, vanity);
    const ms = Date.now() - t0;

    console.log(`email   : ${email}`);
    console.log(`vanity  : ${vanity}`);
    console.log(`result  : ${result === null ? 'null (INCONCLUSIVE — node will fall back to DOM)' : result}`);
    console.log(`took    : ${ms}ms`);
    console.log(
        result === null
            ? 'VERDICT: endpoint did not return a usable payload — the sent-invite check is NOT working.'
            : 'VERDICT: endpoint works; true/false is a real answer from LinkedIn.',
    );
    process.exit(0);
})().catch((e) => { console.error('FAILED:', e?.message); process.exit(1); });
