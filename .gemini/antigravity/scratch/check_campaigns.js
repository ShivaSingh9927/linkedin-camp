
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      userId: true
    }
  });
  console.log('--- Campaigns ---');
  console.log(JSON.stringify(campaigns, null, 2));

  const leads = await prisma.campaignLead.findMany({
    select: {
      id: true,
      campaignId: true,
      leadId: true,
      status: true,
      nextActionDate: true,
      isCompleted: true
    }
  });
  console.log('--- Campaign Leads ---');
  console.log(JSON.stringify(leads, null, 2));
}

main().finally(() => prisma.$disconnect());
