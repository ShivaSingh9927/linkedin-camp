// Reconcile Lead.connectionDegree against LinkedIn's own connections list.
//
// ENV: QUSER_ID (one user), or QALL=1 for every user with a session.
//      QDRY=1 reports what would change without writing.

import { prisma } from '@repo/db';
import { reconcileConnectionDegrees } from '../services/connection-reconcile.service';

async function main() {
    const ids = process.env.QALL === '1'
        ? (await prisma.user.findMany({ where: { sessionInvalid: false }, select: { id: true } })).map((u) => u.id)
        : [process.env.QUSER_ID!].filter(Boolean);
    if (!ids.length) { console.error('QUSER_ID or QALL=1 required'); process.exit(2); }

    for (const id of ids) {
        const before = await prisma.lead.count({ where: { userId: id, connectionDegree: 1 } });
        const r = await reconcileConnectionDegrees(id);
        if (!r.ok) { console.log(`${id}: FAILED — ${r.error}`); continue; }
        const after = await prisma.lead.count({ where: { userId: id, connectionDegree: 1 } });
        console.log(
            `${id}: offered ${r.reported} connections, read ${r.fetched} `
            + `(list ${r.complete ? 'complete' : 'INCOMPLETE — absences not acted on'}) | `
            + `degree-1 leads ${before} → ${after} | promoted ${r.promoted}, cleared ${r.cleared}, unchanged ${r.unchanged}`,
        );
    }
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e?.message || e); await prisma.$disconnect(); process.exit(1); });
