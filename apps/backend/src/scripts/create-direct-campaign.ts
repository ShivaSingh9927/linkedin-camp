import { PrismaClient } from '@repo/db';

const prisma = new PrismaClient();

async function main() {
  const userId = 'eef74901-4b70-44a8-89b9-437f6210d5ff';
  const campaignId = 'test-camp-' + Date.now();
  
  // Create a brand new test lead not in any other campaign
  const newLeadId = 'test-lead-' + Date.now();
  
  // Create fresh lead
  const lead = await prisma.lead.create({
    data: {
      id: newLeadId,
      userId,
      linkedinUrl: 'https://www.linkedin.com/in/shiva-singh-genai-llm/',
      firstName: 'Shiva',
      lastName: 'Test'
    }
  });
  
  console.log('Created lead:', lead.id);
  
  // Create campaign
  const workflow = {
    nodes: [
      { node: 'profile-visit' },
      { node: 'connect' }
    ]
  };
  
  const campaign = await prisma.campaign.create({
    data: {
      id: campaignId,
      userId,
      name: 'Direct Test Campaign',
      workflowJson: workflow,
      status: 'DRAFT'
    }
  });
  
  console.log('Created campaign:', campaign.id);
  
  // Add lead to campaign
  await prisma.campaignLead.create({
    data: {
      id: 'cl-' + Date.now(),
      campaignId: campaign.id,
      leadId: lead.id
    }
  });
  
  console.log('Added lead to campaign');
  console.log('\n=== Campaign Ready ===');
  console.log('Campaign ID:', campaign.id);
  console.log('Lead ID:', lead.id);
  console.log('Run with: curl -X POST http://localhost:3001/api/v1/campaigns/' + campaign.id + '/start');
  
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });