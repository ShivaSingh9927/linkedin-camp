import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Create a Test User
    const user = await prisma.user.upsert({
        where: { email: 'test@example.com' },
        update: {},
        create: {
            email: 'test@example.com',
            passwordHash,
            tier: 'PRO',
        },
    });

    console.log('User created:', user.email);

    // 2. Create some Leads
    const leadsData = [
        { firstName: 'Shiva', lastName: 'Kumar', jobTitle: 'Graphic Designer', company: 'Creative Studios', linkedinUrl: 'https://www.linkedin.com/in/shiva-test' },
        { firstName: 'John', lastName: 'Doe', jobTitle: 'Marketing Head', company: 'Saasly', linkedinUrl: 'https://www.linkedin.com/in/johndoe-test' },
        { firstName: 'Alice', lastName: 'Smith', jobTitle: 'Recruiter', company: 'HireMe', linkedinUrl: 'https://www.linkedin.com/in/alicesmith-test' },
    ];

    for (const lead of leadsData) {
        await prisma.lead.upsert({
            where: { userId_linkedinUrl: { userId: user.id, linkedinUrl: lead.linkedinUrl } },
            update: {},
            create: { ...lead, userId: user.id },
        });
    }

    console.log('Sample leads created.');

    // 3. Create a Sample Campaign
    const campaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: 'Graphic Designers Outreach',
            status: 'DRAFT',
            workflowJson: {
                nodes: [
                    { id: 'node_1', position: { x: 250, y: 50 }, data: { label: 'Trigger: Lead Added', type: 'TRIGGER', subType: 'START' }, type: 'input' },
                    { id: 'node_2', position: { x: 250, y: 150 }, data: { label: 'Visit Profile', type: 'ACTION', subType: 'PROFILE_VISIT' } },
                ],
                edges: [
                    { id: 'e1-2', source: 'node_1', target: 'node_2' }
                ]
            }
        }
    });

    console.log('Sample campaign created:', campaign.name);
}

main()
    .catch((e) => {
        console.error(e);
        process.env.NODE_ENV === 'production' ? process.exit(1) : null;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
