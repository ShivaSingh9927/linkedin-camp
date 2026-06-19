import { PrismaClient } from '@repo/db';

// One-time cleanup: removes duplicate Lead rows that share the same owner +
// normalized LinkedIn URL (trailing-slash / query-string variants), keeping the
// most-complete (then oldest) row. Deleting a Lead cascades its child rows.
// Dry-run by default; pass --apply to actually delete.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL?.replace(/"/g, '') } },
});

const norm = (u: string) => (u || '').trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
const APPLY = process.argv.includes('--apply');

async function main() {
  const leads = await prisma.lead.findMany({
    select: { id: true, userId: true, linkedinUrl: true, createdAt: true, jobTitle: true, company: true, email: true, aboutInfo: true },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map<string, any[]>();
  for (const l of leads) {
    const k = `${l.userId}|${norm(l.linkedinUrl)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }

  const score = (r: any) => (r.jobTitle ? 1 : 0) + (r.company ? 1 : 0) + (r.email ? 1 : 0) + (r.aboutInfo ? 1 : 0);
  const toDelete: string[] = [];
  let dupGroups = 0;
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    dupGroups++;
    rows.sort((a, b) => score(b) - score(a) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (const r of rows.slice(1)) toDelete.push(r.id);
  }

  console.log(`total leads: ${leads.length} | duplicate groups: ${dupGroups} | rows to delete: ${toDelete.length}`);
  if (toDelete.length && APPLY) {
    const res = await prisma.lead.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`DELETED ${res.count} duplicate rows.`);
  } else if (toDelete.length) {
    console.log('DRY RUN — re-run with --apply to delete the duplicates.');
  } else {
    console.log('No duplicates found.');
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
