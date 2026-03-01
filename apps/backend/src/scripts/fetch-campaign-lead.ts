import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: ts-node src/scripts/fetch-campaign-lead.ts <campaignLeadId>');
        process.exit(1);
    }
    const campaignLeadId = args[0];
    const cl = await prisma.campaignLead.findUnique({
        where: { id: campaignLeadId },
        include: { lead: true, campaign: true },
    });
    if (!cl) {
        console.error('CampaignLead not found');
        process.exit(1);
    }
    console.log('--- CampaignLead ---');
    console.log('ID:', cl.id);
    console.log('Campaign:', cl.campaign.name);
    console.log('Lead:', cl.lead.firstName, cl.lead.lastName);
    console.log('Personalization (icebreaker):', cl.personalization);
    // Example of injecting variables into a message template (if you have one)
    const template = 'Hello {firstName}, {icebreaker}';
    const message = template
        .replace('{firstName}', cl.lead.firstName || '')
        .replace('{icebreaker}', cl.personalization || '');
    console.log('Sample injected message:', message);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
