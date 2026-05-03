import { PrismaClient } from '@repo/db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL?.replace(/"/g, '')
    }
  }
});

async function main() {
  console.log('=== Checking Campaign test-camp-1777753044376 ===\n');

  const actionLogs = await prisma.actionLog.findMany({
    where: { campaignId: 'test-camp-1777753044376' },
    orderBy: { executedAt: 'desc' },
    take: 20
  });
  
  console.log('=== Action Logs ===');
  console.log('Count:', actionLogs.length);
  
  for (const log of actionLogs) {
    console.log(`- Node: ${log.actionType} | Status: ${log.status} | At: ${log.executedAt}`);
    if (log.errorMessage) console.log(`  Error: ${log.errorMessage}`);
  }
  
  const campaignLeads = await prisma.campaignLead.findMany({
    where: { campaignId: 'test-camp-1777753044376' }
  });
  
  console.log('\n=== Campaign Leads ===');
  console.log('Count:', campaignLeads.length);
  for (const cl of campaignLeads) {
    console.log(`- Lead: ${cl.leadId} | Completed: ${cl.isCompleted} | Status: ${cl.status}`);
  }

  const workerLogs = await prisma.workerLog.findMany({
    where: { campaignId: 'test-camp-1777753044376' },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('\n=== Worker Logs ===');
  console.log('Count:', workerLogs.length);
  for (const log of workerLogs) {
    console.log(`- Action: ${log.action} | Status: ${log.status} | At: ${log.createdAt}`);
    if (log.errorMessage) console.log(`  Error: ${log.errorMessage}`);
  }
  
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });