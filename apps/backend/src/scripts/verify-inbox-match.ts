// Does every inbox thread resolve to the right lead?
//
// Read-only. Pulls the live thread list and runs the matcher the worker uses,
// reporting which threads find a lead and which do not. Writes nothing and
// sends nothing.
//
// ENV: QUSER_ID

import { prisma } from '@repo/db';
import { syncInbox, warmSelfCache, getBrowserlessVoyagerContext } from '../services/voyager-api.service';
import { buildLeadIndex, matchLead } from '../workers/inbox.worker';

async function main() {
    const userId = process.env.QUSER_ID!;
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }

    const bl = await getBrowserlessVoyagerContext(userId);
    const apiRequest = bl?.ctx;
    try {
        await warmSelfCache(userId, null, apiRequest);
        const r = await syncInbox(userId, null, { maxThreads: 40 }, apiRequest);
        if (!r.ok) { console.error('inbox read failed:', (r as any).error); process.exit(1); }
        const threads = (r.data as any).conversations || [];
        const index = await buildLeadIndex(userId);
        console.log(`threads: ${threads.length}   leads indexed: ${index.byName.size} names / ${index.byVanity.size} vanities\n`);

        let matched = 0, missed = 0;
        for (const c of threads) {
            const who = `${c.otherFirstName} ${c.otherLastName || ''}`.trim();
            const lead = matchLead(index, c);
            if (lead) {
                matched++;
                const leadName = `${lead.firstName} ${lead.lastName || ''}`.trim();
                const via = /^ACoAA/i.test(String(c.otherProfileUrl || '').split('/in/')[1] || '') ? 'name' : 'vanity-or-name';
                console.log(`  ✅ ${who.padEnd(26)} → ${leadName.padEnd(26)} (${via})`);
            } else {
                missed++;
                console.log(`  ❌ ${who.padEnd(26)} → NO LEAD  url=${String(c.otherProfileUrl || '').slice(-28)}`);
            }
        }
        console.log(`\nmatched ${matched}, unmatched ${missed}`);
        console.log('(unmatched is expected for people who are not saved as leads)');
    } finally {
        await bl?.dispose().catch(() => {});
    }
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e?.message || e); await prisma.$disconnect(); process.exit(1); });
