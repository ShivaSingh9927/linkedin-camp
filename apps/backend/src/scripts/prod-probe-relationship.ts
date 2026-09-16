// Read-only: what does LinkedIn say about these leads right now?
// No clicks, no browser — the dash topcard via the saved session + pinned proxy.
//
// ENV: QUSER_ID, QSLUGS (comma-separated vanity slugs)

import { PrismaClient } from '@repo/db';
import { getMemberRelationship, getBrowserlessVoyagerContext } from '../services/voyager-api.service';

const prisma = new PrismaClient();

async function main() {
    const userId = process.env.QUSER_ID!;
    const slugs = (process.env.QSLUGS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!userId || !slugs.length) { console.error('QUSER_ID and QSLUGS required'); process.exit(2); }

    // voyagerFetch is gated on a Playwright request context — browser-free is
    // fine, but "no context" silently returns null, which reads as "no invite"
    // and would answer the question wrongly.
    const { ctx, dispose } = await getBrowserlessVoyagerContext(userId);
    try {
        for (const slug of slugs) {
            const rel = await getMemberRelationship(userId, slug, null, ctx)
                .catch((e: any) => ({ error: e.message } as any));
            console.log(`${slug.padEnd(40)} ${JSON.stringify(rel)}`);
        }
    } finally {
        await dispose().catch(() => {});
    }
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
