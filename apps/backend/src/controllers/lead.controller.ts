import { Response } from 'express';
import { prisma } from '../server';
import { parse } from 'csv-parse';
import fs from 'fs';

// Helper to get team user ids
const getTeamUserIds = async (userId: string) => {
    const member = await prisma.teamMember.findFirst({
        where: { userId },
        include: { team: { include: { members: true } } }
    });
    return member ? member.team.members.map((m: { userId: string }) => m.userId) : [];
};

const bulkImportLeads = async (userId: string, incomingLeads: any[], teamUserIds: string[]) => {
    // 1. Array Deduplication
    const uniqueLeadsMap = new Map();
    for (const lead of incomingLeads) {
        if (lead.linkedinUrl) {
            uniqueLeadsMap.set(lead.linkedinUrl, lead);
        }
    }
    const uniqueLeads = Array.from(uniqueLeadsMap.values());
    const leadUrls = uniqueLeads.map(l => l.linkedinUrl);

    if (leadUrls.length === 0) return { successful: [], duplicatesSkipped: 0 };

    // 2. Fetch existing leads
    const existingTeamLeads = await prisma.lead.findMany({
        where: {
            linkedinUrl: { in: leadUrls },
            userId: { in: teamUserIds }
        },
        select: { id: true, userId: true, linkedinUrl: true }
    });

    const existingTeamLeadUrls = new Set(existingTeamLeads.map((l: any) => l.linkedinUrl));
    const userExistingLeadsMap = new Map<string, any>(
        existingTeamLeads.filter((l: any) => l.userId === userId).map((l: any) => [l.linkedinUrl, l])
    );

    const leadsToCreate = [];
    const leadsToUpdate: any[] = [];
    let duplicatesSkipped = 0;

    for (const lead of uniqueLeads) {
        const nameParts = (lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`).trim().split(' ');
        const firstName = lead.firstName || nameParts[0] || 'Unknown';
        const lastName = lead.lastName || nameParts.slice(1).join(' ') || '';
        const jobTitle = lead.jobTitle || lead.title;

        // Anti-duplication check across team
        if (teamUserIds.length > 1 && existingTeamLeadUrls.has(lead.linkedinUrl) && !userExistingLeadsMap.has(lead.linkedinUrl)) {
            duplicatesSkipped++;
            continue;
        }

        if (userExistingLeadsMap.has(lead.linkedinUrl)) {
            const existingId = userExistingLeadsMap.get(lead.linkedinUrl)!.id;
            leadsToUpdate.push(prisma.lead.update({
                where: { id: existingId },
                data: {
                    firstName,
                    lastName,
                    jobTitle,
                    company: lead.company,
                    email: lead.email,
                    country: lead.country,
                    gender: lead.gender,
                    tags: lead.tags?.length ? lead.tags : undefined,
                }
            }));
        } else {
            leadsToCreate.push({
                userId,
                linkedinUrl: lead.linkedinUrl,
                firstName,
                lastName,
                jobTitle,
                company: lead.company,
                email: lead.email,
                country: lead.country,
                gender: lead.gender,
                tags: lead.tags || [],
            });
        }
    }

    if (leadsToCreate.length > 0) {
        await prisma.lead.createMany({
            data: leadsToCreate,
            skipDuplicates: true
        });
    }

    if (leadsToUpdate.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < leadsToUpdate.length; i += batchSize) {
            await Promise.all(leadsToUpdate.slice(i, i + batchSize));
        }
    }

    // Return the processed leads 
    const allProcessedUrls = [...leadsToCreate.map(l => l.linkedinUrl), ...Array.from(userExistingLeadsMap.keys())];
    const successful = await prisma.lead.findMany({
        where: { userId, linkedinUrl: { in: allProcessedUrls } }
    });

    return { successful, duplicatesSkipped };
};

export const importLeads = async (req: any, res: Response) => {
    const { leads, campaignId } = req.body;
    const userId = req.user.id;

    if (!leads || !Array.isArray(leads)) {
        return res.status(400).json({ error: 'Invalid leads data' });
    }

    try {
        const teamUserIds = await getTeamUserIds(userId);
        const { successful, duplicatesSkipped: duplicates } = await bulkImportLeads(userId, leads, teamUserIds);

        let injectedCount = 0;
        let activeSkippedCount = 0;

        // If a campaignId was provided, inject the safe leads into the campaign
        if (campaignId && successful.length > 0) {
            const leadIds = successful.map((l: any) => l.id);

            // Deduplication Engine: Strict check for currently active campaigns
            const activeLeadsInCampaigns = await prisma.campaignLead.findMany({
                where: {
                    leadId: { in: leadIds },
                    isCompleted: false
                },
                select: { leadId: true }
            });

            const activeLeadIds = new Set(activeLeadsInCampaigns.map((cl: any) => cl.leadId));
            const safeLeadIdsToStart = leadIds.filter((id: any) => !activeLeadIds.has(id));

            activeSkippedCount = activeLeadIds.size;
            injectedCount = safeLeadIdsToStart.length;

            if (safeLeadIdsToStart.length > 0) {
                const campaign = await prisma.campaign.findUnique({ where: { id: campaignId, userId } });
                if (campaign) {
                    const workflow = campaign.workflowJson as any;
                    const startNode = workflow.nodes?.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflow.nodes?.[0];
                    const firstEdge = workflow.edges?.find((e: any) => e.source === startNode?.id);
                    const firstStepId = firstEdge ? firstEdge.target : startNode?.id;

                    await prisma.campaignLead.createMany({
                        data: safeLeadIdsToStart.map((leadId: any) => ({
                            campaignId,
                            leadId,
                            currentStepId: firstStepId,
                            nextActionDate: new Date(),
                        })),
                        skipDuplicates: true,
                    });

                    // Ensure campaign is active
                    if (campaign.status === 'DRAFT') {
                        await prisma.campaign.update({
                            where: { id: campaignId },
                            data: { status: 'ACTIVE' }
                        });
                    }
                }
            }
        }

        res.json({
            success: true,
            importedTotal: successful.length,
            duplicatesSkipped: duplicates,
            campaignInjected: injectedCount,
            activeCollisionSkipped: activeSkippedCount,
            message: `${successful.length} leads imported successfully. ${activeSkippedCount > 0 ? `(${activeSkippedCount} leads skipped because they are already active in a campaign).` : ''}`,
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

        const teamUserIds = await getTeamUserIds(userId);
        const { successful, duplicatesSkipped: duplicates } = await bulkImportLeads(userId, leads, teamUserIds);

        let injectedCount = 0;
        let activeSkippedCount = 0;
        const { campaignId } = req.body || {};

        if (campaignId && successful.length > 0) {
            const leadIds = successful.map((l: any) => l.id);

            const activeLeadsInCampaigns = await prisma.campaignLead.findMany({
                where: {
                    leadId: { in: leadIds },
                    isCompleted: false
                },
                select: { leadId: true }
            });

            const activeLeadIds = new Set(activeLeadsInCampaigns.map((cl: any) => cl.leadId));
            const safeLeadIdsToStart = leadIds.filter((id: any) => !activeLeadIds.has(id));

            activeSkippedCount = activeLeadIds.size;
            injectedCount = safeLeadIdsToStart.length;

            if (safeLeadIdsToStart.length > 0) {
                const campaign = await prisma.campaign.findUnique({ where: { id: campaignId, userId } });
                if (campaign) {
                    const workflow = campaign.workflowJson as any;
                    const startNode = workflow.nodes?.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflow.nodes?.[0];
                    const firstEdge = workflow.edges?.find((e: any) => e.source === startNode?.id);
                    const firstStepId = firstEdge ? firstEdge.target : startNode?.id;

                    await prisma.campaignLead.createMany({
                        data: safeLeadIdsToStart.map((leadId: any) => ({
                            campaignId,
                            leadId,
                            currentStepId: firstStepId,
                            nextActionDate: new Date(),
                        })),
                        skipDuplicates: true,
                    });

                    if (campaign.status === 'DRAFT') {
                        await prisma.campaign.update({
                            where: { id: campaignId },
                            data: { status: 'ACTIVE' }
                        });
                    }
                }
            }
        }

        fs.unlinkSync(file.path);

        res.json({
            success: true,
            importedTotal: successful.length,
            duplicatesSkipped: duplicates,
            campaignInjected: injectedCount,
            activeCollisionSkipped: activeSkippedCount,
            message: `${successful.length} leads imported from CSV successfully. ${activeSkippedCount > 0 ? `(${activeSkippedCount} skipped from campaign injection because already active).` : ''}`,
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
        const teamUserIds = await getTeamUserIds(userId);
        await bulkImportLeads(userId, demoLeads, teamUserIds);
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
