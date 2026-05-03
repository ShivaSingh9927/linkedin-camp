require('dotenv').config({ path: '/home/shiva/Documents/linkedin-camp/.env' });

const { PrismaClient } = require('@repo/db');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL?.replace(/"/g, '')
    }
  }
});

async function main() {
  // Find user
  const user = await prisma.user.findUnique({ where: { email: 'rajaji98971@gmail.com' } });
  console.log('User ID:', user?.id);
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  // Create campaign
  const campaignId = 'test-camp-' + Date.now();
  const workflow = {
    nodes: [
      { node: 'profile-visit' },
      { node: 'comment-nth-post', n: 1, aiEnabled: true },
      { node: 'connect' },
      { 
        node: 'if-else',
        condition: { field: 'connected', operator: 'is_true' },
        trueBranch: [
          { node: 'send-message', aiEnabled: true }
        ],
        falseBranch: [
          { node: 'delay', hours: 0.001 },
          { node: 'check-connection' },
          { 
            node: 'if-else',
            condition: { field: 'connected', operator: 'is_true' },
            trueBranch: [
              { node: 'send-message', aiEnabled: true }
            ],
            falseBranch: []
          }
        ]
      }
    ]
  };
  
  const campaign = await prisma.campaign.create({
    data: {
      id: campaignId,
      userId: user.id,
      name: 'Test Campaign - Profile Visit>Comment>Connect>IfElse>Message',
      workflowJson: workflow,
      status: 'DRAFT'
    }
  });
  console.log('Campaign created:', campaign.id);
  
  // Create or find lead
  const linkedinUrl = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
  
  let lead = await prisma.lead.findFirst({
    where: { userId: user.id, linkedinUrl: linkedinUrl }
  });
  
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        id: 'lead-' + Date.now(),
        userId: user.id,
        linkedinUrl: linkedinUrl,
        firstName: 'Shiva',
        lastName: 'Singh'
      }
    });
    console.log('Lead created:', lead.id);
  } else {
    console.log('Lead already exists:', lead.id);
  }
  
  // Add to campaign
  const existingCampaignLead = await prisma.campaignLead.findFirst({
    where: { campaignId: campaign.id, leadId: lead.id }
  });
  
  if (!existingCampaignLead) {
    await prisma.campaignLead.create({
      data: {
        id: 'cl-' + Date.now(),
        campaignId: campaign.id,
        leadId: lead.id
      }
    });
    console.log('Lead added to campaign');
  } else {
    console.log('Lead already in campaign');
  }
  
  console.log('\n=== Campaign Ready ===');
  console.log('Campaign ID:', campaign.id);
  console.log('Lead ID:', lead.id);
  console.log('\nTo start campaign, run:');
  console.log('curl -X POST http://localhost:3001/api/v1/campaigns/' + campaign.id + '/start -H "Authorization: Bearer <token>"');
  
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });