import { Response } from 'express';
import { prisma } from '../server';

export const importLeads = async (req: any, res: Response) => {
    const { leads } = req.body;
    const userId = req.user.id;

    try {
        const importResults = await Promise.all(
            leads.map(async (lead: any) => {
                const nameParts = (lead.name || `${lead.firstName} ${lead.lastName}`).split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || '';

                return prisma.lead.upsert({
                    where: {
                        userId_linkedinUrl: {
                            userId,
                            linkedinUrl: lead.linkedinUrl,
                        },
                    },
                    update: {
                        firstName,
                        lastName,
                        jobTitle: lead.jobTitle,
                    },
                    create: {
                        userId,
                        linkedinUrl: lead.linkedinUrl,
                        firstName,
                        lastName,
                        jobTitle: lead.jobTitle,
                    },
                });
            })
        );

        res.json({
            success: true,
            count: importResults.length,
            message: `${importResults.length} leads imported successfully`,
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import leads' });
    }
};

export const generateDemoLeads = async (req: any, res: Response) => {
    const userId = req.user.id;
    const demoLeads = [
        { firstName: 'Sarah', lastName: 'Conner', jobTitle: 'SaaS Founder', company: 'FutureTech', linkedinUrl: 'https://li.shiva.test/sarah' },
        { firstName: 'James', lastName: 'Bond', jobTitle: 'Sales Director', company: 'MI6', linkedinUrl: 'https://li.shiva.test/bond' },
        { firstName: 'Elon', lastName: 'Musk', jobTitle: 'Product Manager', company: 'SpaceX', linkedinUrl: 'https://li.shiva.test/elon' }
    ];

    try {
        await Promise.all(demoLeads.map(lead =>
            prisma.lead.upsert({
                where: { userId_linkedinUrl: { userId, linkedinUrl: lead.linkedinUrl } },
                update: {},
                create: { ...lead, userId }
            })
        ));
        res.json({ success: true, message: 'Demo leads generated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate demo leads' });
    }
};

export const getLeads = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const leads = await prisma.lead.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};
