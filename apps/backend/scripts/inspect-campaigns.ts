import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
    const campaignIds = ['CMQ41MLU', 'CMQ1XEP', 'CMPZTG'];

    for (const id of campaignIds) {
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                CampaignLead: {
                    include: { Lead: true },
                },
            },
        });

        if (!campaign) {
            console.log(`\n=== Campaign ${id} === NOT FOUND`);
            continue;
        }

        const total = campaign.CampaignLead.length;
        const enriched = campaign.CampaignLead.filter(cl => cl.Lead.company || cl.Lead.jobTitle).length;
        const withAbout = campaign.CampaignLead.filter(cl => cl.Lead.aboutInfo).length;
        const withEmail = campaign.CampaignLead.filter(cl => cl.Lead.email).length;
        const completed = campaign.CampaignLead.filter(cl => cl.isCompleted).length;

        console.log(`\n=== Campaign ${id}: ${campaign.name} ===`);
        console.log(`  Status: ${campaign.status}`);
        console.log(`  Total leads: ${total}`);
        console.log(`  Completed: ${completed}`);
        console.log(`  Enriched (company/job): ${enriched}`);
        console.log(`  With About: ${withAbout}`);
        console.log(`  With Email: ${withEmail}`);
        console.log(`  Leads:`);
        for (const cl of campaign.CampaignLead.slice(0, 10)) {
            const l = cl.Lead;
            console.log(`    - ${l.firstName} ${l.lastName} | ${l.jobTitle || '-'} @ ${l.company || '-'} | about=${l.aboutInfo ? l.aboutInfo.substring(0, 40) + '...' : 'none'} | email=${l.email || '-'}`);
        }
        if (total > 10) console.log(`    ... and ${total - 10} more`);
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
