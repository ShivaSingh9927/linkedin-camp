// Run the health watch once, now, and print what it would file.
// Read-only apart from the Notification rows it is supposed to create.
import { prisma } from '@repo/db';
import { runHealthWatch } from '../services/health-watch.service';

runHealthWatch()
    .then(async (r) => {
        console.log(`checked ${r.checked} user(s), filed ${r.filed} finding(s)`);
        const recent = await prisma.notification.findMany({
            where: { createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } },
            select: { title: true, body: true, type: true },
        });
        for (const n of recent) console.log(`  [${n.type}] ${n.title} — ${n.body}`);
        await prisma.$disconnect();
    })
    .catch(async (e) => { console.error(e?.message || e); await prisma.$disconnect(); process.exit(1); });
