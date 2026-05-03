import { PrismaClient } from '@repo/db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL?.replace(/"/g, '')
    }
  }
});

async function main() {
  const campaignId = 'test-camp-1777753044376';
  
  const campaignLeads = await prisma.campaignLead.findMany({
    where: { campaignId }
  });
  
  console.log('=== Campaign Leads ===');
  console.log('Count:', campaignLeads.length);
  
  for (const cl of campaignLeads) {
    console.log(`- leadId: ${cl.leadId} | completed: ${cl.isCompleted} | status: ${cl.status}`);
  }

  const leadIds = campaignLeads.map((cl: any) => cl.leadId);
  
  if (leadIds.length > 0) {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } }
    });
    
    console.log('\n=== Lead Details ===');
    for (const lead of leads) {
      console.log(`- Name: ${lead.firstName} ${lead.lastName} | URL: ${lead.linkedinUrl}`);
    }
  }
  
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });