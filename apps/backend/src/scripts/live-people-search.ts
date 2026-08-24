/**
 * live-people-search.ts
 *
 * Live validation of searchPeople against a real saved session (rajaji).
 * READ-ONLY: exercises the browser-free path (+ DOM fallback if needed) and the
 * monthly-quota reader. Does NOT log a search action, so it consumes no budget.
 *
 *   QCAP_EMAIL=rajaji98971@gmail.com QCAP_KEYWORDS="software AND manager" \
 *     node dist/scripts/live-people-search.js
 */
import { PrismaClient } from '@repo/db';
import { searchPeople } from '../services/people-search.service';
import { checkSearchQuota } from '../campaign-engine/safety/quota';

const prisma = new PrismaClient();
const email = process.env.QCAP_EMAIL || 'rajaji98971@gmail.com';
const keywords = process.env.QCAP_KEYWORDS || 'software AND manager';

(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error(`[live] no user for ${email}`); process.exit(2); }
    console.log(`[live] user=${user.id} keywords="${keywords}"`);

    const before = await checkSearchQuota(user.id);
    console.log(`[live] quota: used=${before.used} cap=${before.cap} remaining=${before.remaining} premium=${before.isPremium}`);

    const t = Date.now();
    const res = await searchPeople(user.id, { keywords, limit: 10 });
    console.log(`[live] via=${res.via}  people=${res.people.length}  (${Date.now() - t}ms)`);
    res.people.forEach((p) =>
        console.log(`   • ${p.name} [${p.connectionDegree ?? '?'}] ${p.jobTitle}${p.company ? ' @ ' + p.company : ''} | ${p.location} → ${p.linkedinUrl}`),
    );

    if (res.people.length === 0) console.log('[live] ⚠ 0 people — inspect (block? markup churn?).');
    else console.log(`[live] ✅ ${res.via} path returned ${res.people.length} structured people.`);

    await prisma.$disconnect().catch(() => {});
    process.exit(res.people.length > 0 ? 0 : 1);
})();
