import { PrismaClient } from '@repo/db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL?.replace(/"/g, '')
    }
  }
});

async function main() {
  const leadId = '1b47e9e1-aaf8-436a-86a6-baa3e65a9822';
  
  const campaignLeads = await prisma.campaignLead.findMany({
    where: { leadId, isCompleted: false },
    include: { Campaign: true }
  });
  
  console.log('=== Active in campaigns ===');
  console.log('Count:', campaignLeads.length);
  
  for (const cl of campaignLeads) {
    console.log(`- Campaign: ${cl.campaignId} | ${cl.Campaign?.name} | Status: ${cl.Campaign?.status}`);
  }
  
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });