import { Response } from 'express';
import { prisma } from '../server';
import { parse } from 'csv-parse';
import fs from 'fs';

const upsertLead = async (userId: string, lead: any) => {
    const nameParts = (lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`).trim().split(' ');
    const firstName = lead.firstName || nameParts[0] || 'Unknown';
    const lastName = lead.lastName || nameParts.slice(1).join(' ') || '';

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
            jobTitle: lead.jobTitle || lead.title,
            company: lead.company,
            email: lead.email,
            country: lead.country,
            gender: lead.gender,
            tags: lead.tags || [],
        },
        create: {
            userId,
            linkedinUrl: lead.linkedinUrl,
            firstName,
            lastName,
            jobTitle: lead.jobTitle || lead.title,
            company: lead.company,
            email: lead.email,
            country: lead.country,
            gender: lead.gender,
            tags: lead.tags || [],
        },
    });
};

export const importLeads = async (req: any, res: Response) => {
    const { leads } = req.body;
    const userId = req.user.id;

    if (!leads || !Array.isArray(leads)) {
        return res.status(400).json({ error: 'Invalid leads data' });
    }

    try {
        const importResults = await Promise.all(
            leads.map((lead: any) => upsertLead(userId, lead))
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

export const uploadCsvLeads = async (req: any, res: Response) => {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const leads: any[] = [];

    try {
        const parser = fs.createReadStream(file.path).pipe(
            parse({
                columns: true,
                skip_empty_lines: true,
                trim: true
            })
        );

        for await (const record of parser) {
            const mappedLead = {
                linkedinUrl: record['LinkedIn URL'] || record['url'] || record['linkedinUrl'],
                firstName: record['First Name'] || record['firstName'],
                lastName: record['Last Name'] || record['lastName'],
                jobTitle: record['Job Title'] || record['title'] || record['jobTitle'],
                company: record['Company'] || record['company'],
                email: record['Email'] || record['email'],
                country: record['Country'] || record['country'],
                gender: record['Gender'] || record['gender'],
                tags: (record['Tags'] || record['tags'] || '').split(',').map((t: string) => t.trim()).filter(Boolean),
            };

            if (mappedLead.linkedinUrl) {
                leads.push(mappedLead);
            }
        }

        const importResults = await Promise.all(
            leads.map(lead => upsertLead(userId, lead))
        );

        fs.unlinkSync(file.path);

        res.json({
            success: true,
            count: importResults.length,
            message: `${importResults.length} leads imported from CSV successfully`,
        });
    } catch (error) {
        console.error('CSV Import error:', error);
        if (file.path) fs.unlinkSync(file.path);
        res.status(500).json({ error: 'Failed to parse CSV file' });
    }
};

export const generateDemoLeads = async (req: any, res: Response) => {
    const userId = req.user.id;
    const demoLeads = [
        { firstName: 'Sarah', lastName: 'Conner', jobTitle: 'SaaS Founder', company: 'FutureTech', linkedinUrl: 'https://li.shiva.test/sarah', email: 'sarah@futuretech.io', country: 'United States', gender: 'Female', tags: ['hot-lead', 'saas'] },
        { firstName: 'James', lastName: 'Bond', jobTitle: 'Sales Director', company: 'MI6', linkedinUrl: 'https://li.shiva.test/bond', email: 'james@mi6.gov.uk', country: 'United Kingdom', gender: 'Male', tags: ['enterprise'] },
        { firstName: 'Elon', lastName: 'Musk', jobTitle: 'Product Manager', company: 'SpaceX', linkedinUrl: 'https://li.shiva.test/elon', email: 'elon@spacex.com', country: 'United States', gender: 'Male', tags: ['vip', 'tech-leader'] },
        { firstName: 'Priya', lastName: 'Sharma', jobTitle: 'CTO', company: 'IndiaTech', linkedinUrl: 'https://li.shiva.test/priya', email: 'priya@indiatech.in', country: 'India', gender: 'Female', tags: ['tech-leader', 'startup'] },
        { firstName: 'Akira', lastName: 'Tanaka', jobTitle: 'VP Engineering', company: 'TokyoAI', linkedinUrl: 'https://li.shiva.test/akira', country: 'Japan', gender: 'Male', tags: ['ai', 'enterprise'] },
    ];

    try {
        await Promise.all(demoLeads.map(lead => upsertLead(userId, lead)));
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

export const deleteLead = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await prisma.lead.delete({
            where: { id, userId }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lead' });
    }
};
