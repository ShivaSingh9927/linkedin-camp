import { Response } from 'express';
import { prisma } from '@repo/db';
import { parse } from 'csv-parse';
import fs from 'fs';
import { getActionQueue } from '../services/queue.service';
import { cleanPersonField } from '../campaign-engine/scrape/sanitize';

// Helper to get team user ids
const getTeamUserIds = async (userId: string) => {
    const member = await prisma.teamMember.findFirst({
        where: { userId },
        include: { Team: { include: { TeamMember: true } } }
    });
    return member ? member.Team.TeamMember.map((m: { userId: string }) => m.userId) : [];
};

// Collapse trailing-slash / query-string variants of the same profile URL so
// ".../in/jane-doe/" and ".../in/jane-doe?foo=1" dedup to one lead. Without this
// the (userId, linkedinUrl) unique constraint treats them as distinct → the same
// person imports twice (the bug seen with extension CSVs).
const normalizeLinkedinUrl = (raw?: string): string => {
    if (!raw) return raw || '';
    let u = raw.trim().split('?')[0].split('#')[0];
    u = u.replace(/\/+$/, ''); // drop trailing slash(es)
    return u;
};

const bulkImportLeads = async (userId: string, incomingLeads: any[], teamUserIds: string[]) => {
    // 1. Array Deduplication (on the normalized URL)
    const uniqueLeadsMap = new Map();
    for (const lead of incomingLeads) {
        if (lead.linkedinUrl) {
            const norm = normalizeLinkedinUrl(lead.linkedinUrl);
            uniqueLeadsMap.set(norm, { ...lead, linkedinUrl: norm });
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
        // The extension's `title`/`jobTitle` for search cards is often the
        // degree subtitle ("3rd+ degree connection") or the person's name —
        // drop those rather than storing them as a real role.
        // `jobProfile` is what the smart-extension's structured extractor emits;
        // older payloads send `jobTitle`/`title`. Accept all three.
        const jobTitle = cleanPersonField(lead.jobProfile || lead.jobTitle || lead.title, `${firstName} ${lastName}`);

        // Anti-duplication check across team
        if (teamUserIds.length > 1 && existingTeamLeadUrls.has(lead.linkedinUrl) && !userExistingLeadsMap.has(lead.linkedinUrl)) {
            duplicatesSkipped++;
            continue;
        }

        // Sanitize connectionDegree — extension may send 1/2/3 or null.
        // Anything else (string, undefined, NaN) → null so the column never
        // gets corrupt data from a future malformed scrape.
        let connectionDegree: number | null = null;
        if (lead.connectionDegree === 1 || lead.connectionDegree === 2 || lead.connectionDegree === 3) {
            connectionDegree = lead.connectionDegree;
        }

        // Raw snippet from the search-result card. Trim + cap defensively
        // — the extension already caps to 1000 but a malformed POST could
        // ship more.
        const info: string | null = typeof lead.info === 'string' && lead.info.trim().length > 0
            ? lead.info.trim().substring(0, 2000)
            : null;

        // Education from the extension's extractor is a plain school string —
        // wrap it into the same {school} array shape PROFILE_VISIT enrichment
        // uses, so the prospects drawer renders it. An already-array value
        // (richer enrichment payload) passes through untouched.
        const education = Array.isArray(lead.education)
            ? lead.education
            : (typeof lead.education === 'string' && lead.education.trim()
                ? [{ school: lead.education.trim() }]
                : null);

        const location: string | null = typeof lead.location === 'string' && lead.location.trim()
            ? lead.location.trim()
            : null;

        if (userExistingLeadsMap.has(lead.linkedinUrl)) {
            const existingId = userExistingLeadsMap.get(lead.linkedinUrl)!.id;
            leadsToUpdate.push(prisma.lead.update({
                where: { id: existingId },
                data: {
                    firstName,
                    lastName,
                    // Don't overwrite a good (profile-visit) title with a
                    // re-import that only carries the junk card subtitle.
                    ...(jobTitle ? { jobTitle } : {}),
                    company: lead.company,
                    email: lead.email,
                    country: lead.country,
                    gender: lead.gender,
                    tags: lead.tags?.length ? lead.tags : undefined,
                    // Only overwrite degree if the new scrape has a value —
                    // a later scrape that came in without the badge shouldn't
                    // wipe a previously-known degree.
                    ...(connectionDegree != null ? { connectionDegree } : {}),
                    ...(info != null ? { info } : {}),
                    ...(location != null ? { location } : {}),
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
                connectionDegree,
                info,
                location,
                // Set on create only — a later PROFILE_VISIT enrichment owns the
                // richer version and shouldn't be downgraded by a re-import.
                ...(education ? { education } : {}),
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
                    const workflowNodes = workflow?.nodes || workflow;
                    const startNode = workflowNodes?.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflowNodes?.[0];
                    const firstEdge = workflow.edges?.find((e: any) => e.source === startNode?.id);
                    const firstStepId = firstEdge ? firstEdge.target : startNode?.id;

                    console.log(`[Import] Attempting to inject ${safeLeadIdsToStart.length} leads into campaign ${campaignId}`);
                    await prisma.campaignLead.createMany({
                        data: safeLeadIdsToStart.map((leadId: any) => ({
                            campaignId,
                            leadId,
                            currentStepId: firstStepId,
                            nextActionDate: new Date(),
                        })),
                        skipDuplicates: true,
                    });
                    console.log(`[Import] Successfully injected leads into campaign ${campaignId}`);

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
    // The uploaded file name (minus extension) becomes the list this import
    // lands in — surfaced as a tag the Prospects "Lists" rail groups by.
    const listName: string = (req.body?.listName || '').toString().trim();

    // Dynamic column mapping: CSVs come with wildly different headers. We
    // normalize each header (lowercase, strip spaces/underscores/dashes/dots)
    // and match against a list of aliases per field, so a column called
    // "Profile URL", "linkedin_url" or "LinkedIn" all resolve to linkedinUrl.
    // Only linkedinUrl + a name are required; every other column is optional.
    const FIELD_ALIASES: Record<string, string[]> = {
        linkedinUrl: ['linkedinurl', 'linkedin', 'linkedinprofile', 'linkedinprofileurl', 'profileurl', 'profile', 'url', 'publicprofileurl'],
        firstName: ['firstname', 'first', 'givenname', 'fname'],
        lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
        fullName: ['name', 'fullname', 'displayname'],
        jobTitle: ['jobtitle', 'jobprofile', 'title', 'position', 'role', 'headline', 'currenttitle'],
        company: ['company', 'companyname', 'organization', 'organisation', 'employer', 'currentcompany'],
        email: ['email', 'emailaddress', 'workemail', 'mail'],
        country: ['country', 'region', 'geo'],
        location: ['location', 'city', 'area'],
        gender: ['gender', 'sex'],
        education: ['education', 'school', 'college', 'university'],
        tags: ['tags', 'segments', 'segment'],
    };
    const normKey = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, '');
    // Build alias -> canonical lookup once.
    const aliasToField: Record<string, string> = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        for (const a of aliases) aliasToField[a] = field;
    }

    try {
        const parser = fs.createReadStream(file.path).pipe(
            parse({ columns: true, skip_empty_lines: true, trim: true })
        );

        for await (const record of parser) {
            // Resolve known fields from whatever headers the file has.
            const resolved: Record<string, string> = {};
            for (const [rawKey, rawVal] of Object.entries(record)) {
                const field = aliasToField[normKey(rawKey)];
                if (field && rawVal != null && String(rawVal).trim() && !resolved[field]) {
                    resolved[field] = String(rawVal).trim();
                }
            }

            // Derive first/last from a single full-name column if needed.
            let firstName = resolved.firstName;
            let lastName = resolved.lastName;
            if ((!firstName || !lastName) && resolved.fullName) {
                const parts = resolved.fullName.split(/\s+/);
                firstName = firstName || parts[0];
                lastName = lastName || parts.slice(1).join(' ');
            }

            const fileTags = (resolved.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
            const tags = listName ? [listName, ...fileTags] : fileTags;

            const mappedLead = {
                linkedinUrl: resolved.linkedinUrl,
                firstName,
                lastName,
                jobTitle: cleanPersonField(resolved.jobTitle, `${firstName || ''} ${lastName || ''}`),
                company: resolved.company,
                email: resolved.email,
                country: resolved.country,
                location: resolved.location,
                gender: resolved.gender,
                education: resolved.education,
                tags,
            };

            // Required: a LinkedIn URL plus at least a first name.
            if (mappedLead.linkedinUrl && (mappedLead.firstName || mappedLead.lastName)) {
                leads.push(mappedLead);
            }
        }

        if (leads.length === 0) {
            if (file.path) fs.unlinkSync(file.path);
            return res.status(400).json({
                error: 'No valid rows found. Your file must include a LinkedIn URL and a name (first/last or full name) column.',
            });
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
                    const workflowNodes = workflow?.nodes || workflow;
                    const startNode = workflowNodes?.find((n: any) => n.type === 'TRIGGER' || n.type === 'input') || workflowNodes?.[0];
                    const firstEdge = workflow.edges?.find((e: any) => e.source === startNode?.id);
                    const firstStepId = firstEdge ? firstEdge.target : startNode?.id;

                    console.log(`[CSV] Attempting to inject ${safeLeadIdsToStart.length} leads into campaign ${campaignId}`);
                    await prisma.campaignLead.createMany({
                        data: safeLeadIdsToStart.map((leadId: any) => ({
                            campaignId,
                            leadId,
                            currentStepId: firstStepId,
                            nextActionDate: new Date(),
                        })),
                        skipDuplicates: true,
                    });
                    console.log(`[CSV] Successfully injected leads into campaign ${campaignId}`);

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

export const createManualLead = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { firstName, lastName, linkedinUrl, jobTitle, company, email, country, gender, tags } = req.body;

    if (!linkedinUrl) {
        return res.status(400).json({ error: 'LinkedIn URL is required' });
    }

    try {
        const lead = await prisma.lead.upsert({
            where: { userId_linkedinUrl: { userId, linkedinUrl } },
            update: {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                jobTitle: jobTitle || undefined,
                company: company || undefined,
                email: email || undefined,
                country: country || undefined,
                gender: gender || undefined,
                tags: tags || []
            },
            create: {
                userId,
                linkedinUrl,
                firstName: firstName || '',
                lastName: lastName || '',
                jobTitle,
                company,
                email,
                country,
                gender,
                tags: tags || []
            }
        });
        res.json({ success: true, lead });
    } catch (error) {
        console.error('Error creating manual lead:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
};

export const getLeads = async (req: any, res: Response) => {
    const userId = req.user?.id;

    console.log('getLeads called, userId:', userId);
    console.log('req.user:', req.user);

    if (!userId) {
        console.log('No userId - returning 401');
        return res.status(401).json({ error: 'Unauthorized - no user' });
    }

    try {
        console.log('Querying leads for userId:', userId);
        const leads = await prisma.lead.findMany({
            where: { userId }
        });
        console.log('Found leads:', leads.length);
        
        // Try with CampaignLead include
        try {
            console.log('Trying with CampaignLead include...');
            const leadsWithCampaign = await prisma.lead.findMany({
                where: { userId },
                include: { CampaignLead: true }
            });
            console.log('With CampaignLead success:', leadsWithCampaign.length);
        } catch (innerError: any) {
            console.log('CampaignLead include failed:', innerError.message);
        }
        
        res.json(leads);
    } catch (error: any) {
        console.error('getLeads error:', error);
        res.status(500).json({ error: 'Failed to fetch leads: ' + error.message });
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

export const updateLeadTags = async (req: any, res: Response) => {
    const { id } = req.params;
    const { tags } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Tags must be an array' });
    }

    try {
        const lead = await prisma.lead.update({
            where: { id, userId },
            data: { tags }
        });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update tags' });
    }
};

export const bulkUpdateLeadsTags = async (req: any, res: Response) => {
    const { leadIds, tags, operation } = req.body; // operation: 'ADD', 'REMOVE', 'SET'
    const userId = req.user.id;

    if (!Array.isArray(leadIds) || !Array.isArray(tags)) {
        return res.status(400).json({ error: 'leadIds and tags must be arrays' });
    }

    try {
        if (operation === 'SET') {
            await prisma.lead.updateMany({
                where: { id: { in: leadIds }, userId },
                data: { tags }
            });
        } else {
            // Prisma doesn't support array push/pull in updateMany yet, 
            // so we loop for individual leads in the background or use a raw query if performance is critical.
            // For now, simpler looping logic:
            for (const id of leadIds) {
                const lead = await prisma.lead.findUnique({ where: { id, userId }, select: { tags: true } });
                if (!lead) continue;

                let newTags = [...lead.tags];
                if (operation === 'ADD') {
                    tags.forEach(t => { if (!newTags.includes(t)) newTags.push(t); });
                } else if (operation === 'REMOVE') {
                    newTags = newTags.filter(t => !tags.includes(t));
                }

                await prisma.lead.update({
                    where: { id, userId },
                    data: { tags: newTags }
                });
            }
        }
        res.json({ success: true, message: `Updated ${leadIds.length} leads` });
    } catch (error) {
        console.error('Bulk tag error:', error);
        res.status(500).json({ error: 'Failed to bulk update tags' });
    }
};

export const getCompanies = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        // Fetch leads that have a company associated
        const leads = await prisma.lead.findMany({
            where: { 
                userId, 
                company: { not: null } 
            },
            select: { 
                id: true, 
                company: true, 
                status: true,
                firstName: true,
                lastName: true
            }
        });

        // Normalize so "Google", "Google Inc." and "google" collapse into one
        // account instead of three. The key is lowercased, de-punctuated and
        // stripped of common legal suffixes; the display name is the most
        // frequent original spelling we saw for that key.
        const normalizeCompanyKey = (raw: string) =>
            raw
                .toLowerCase()
                .replace(/[.,]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/\b(inc|incorporated|llc|llp|ltd|limited|corp|corporation|co|company|gmbh|pvt|private|plc|sa|ag|bv)\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();

        const companyGroups: Record<string, any> = {};

        leads.forEach(lead => {
            const original = lead.company?.trim();
            if (!original) return;

            const key = normalizeCompanyKey(original) || original.toLowerCase();

            if (!companyGroups[key]) {
                companyGroups[key] = {
                    name: original,
                    id: key, // normalized grouping key (stable across spelling variants)
                    totalLeads: 0,
                    statusCounts: {
                        IMPORTED: 0,
                        PENDING: 0,
                        CONNECTED: 0,
                        REPLIED: 0,
                        BOUNCED: 0
                    },
                    sampleEmployees: [],
                    _nameVariants: {} as Record<string, number>
                };
            }

            const group = companyGroups[key];
            group.totalLeads++;
            group.statusCounts[lead.status] = (group.statusCounts[lead.status] || 0) + 1;
            group._nameVariants[original] = (group._nameVariants[original] || 0) + 1;

            if (group.sampleEmployees.length < 3) {
                group.sampleEmployees.push(`${lead.firstName} ${lead.lastName}`);
            }
        });

        // Pick the most common original spelling as the display name, then drop
        // the internal tally before returning.
        const result = Object.values(companyGroups)
            .map((g: any) => {
                const variants = g._nameVariants as Record<string, number>;
                g.name = Object.keys(variants).sort((a, b) => variants[b] - variants[a])[0] || g.name;
                delete g._nameVariants;
                return g;
            })
            .sort((a: any, b: any) => b.totalLeads - a.totalLeads);
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

export const enrichLead = async (req: any, res: Response) => {
    const { id: leadId } = req.params;
    const userId = req.user.id;
    const { force = false } = req.body;

    try {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, userId }
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check if data already exists and user is not forcing a refresh
        if (!force && (lead.aboutInfo || lead.company || lead.email)) {
             return res.json({ 
                success: true, 
                alreadyEnriched: true,
                message: 'Lead already enriched. Use "force: true" if you want to re-scrape from LinkedIn.' 
             });
        }

        const actionQueue = getActionQueue();
        
        // Push a manual enrichment job
        await actionQueue.add(
            'execute-workflow-step',
            {
                userId,
                leadId,
                currentStepId: `manual_enrichment_${Date.now()}`,
                workflowJson: {
                    nodes: [{
                        id: `manual_enrichment_${Date.now()}`,
                        type: 'ACTION',
                        data: {
                            subType: 'VISIT',
                            enrichCompany: true,
                            enrichContact: true,
                            enrichAbout: true,
                            enrichPosts: true,
                        }
                    }],
                    edges: []
                }
            },
            {
                removeOnComplete: true,
            }
        );

        res.json({ success: true, message: 'Enrichment task queued successfully.' });
    } catch (error) {
        console.error('Error queuing enrichment:', error);
        res.status(500).json({ error: 'Failed to queue enrichment task' });
    }
};

// ── Per-contact activity timeline ───────────────────────────────────────────
// A unified, newest-first feed of everything that has happened to one lead.
// Pure read: it merges rows that already exist (ActionLog campaign actions +
// Message DMs/emails + the lead's creation) — nothing new is logged anywhere.
// Message rows own all "sent/received" events; ActionLog's own MESSAGE/EMAIL
// rows are dropped here to avoid double-counting the same send.
const TIMELINE_ACTION_LABELS: Record<string, { label: string; kind: string }> = {
    VISIT: { label: 'Profile visited', kind: 'visit' },
    PROFILE_VISIT: { label: 'Profile visited', kind: 'visit' },
    INVITE: { label: 'Invite sent', kind: 'invite' },
    CONNECT: { label: 'Invite sent', kind: 'invite' },
    CHECK_CONNECTION: { label: 'Connection checked', kind: 'status' },
    LIKE: { label: 'Liked a post', kind: 'like' },
    COMMENT: { label: 'Commented on a post', kind: 'comment' },
    FOLLOW: { label: 'Followed', kind: 'follow' },
    EMAIL_FINDER: { label: 'Email lookup', kind: 'status' },
};

export const getLeadTimeline = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const teamIds = await getTeamUserIds(userId);
        const allowedIds = teamIds.length ? teamIds : [userId];

        const lead = await prisma.lead.findFirst({
            where: { id, userId: { in: allowedIds } },
            select: { id: true, createdAt: true, status: true, firstName: true, lastName: true },
        });
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const [actions, messages] = await Promise.all([
            prisma.actionLog.findMany({
                where: { leadId: id },
                select: { id: true, actionType: true, status: true, executedAt: true, campaignId: true, errorMessage: true },
            }),
            prisma.message.findMany({
                where: { leadId: id },
                select: { id: true, direction: true, channel: true, content: true, sentAt: true, campaignId: true, source: true },
            }),
        ]);

        // Resolve campaign names in one shot for context labels.
        const campaignIds = [
            ...new Set([...actions, ...messages].map((r: any) => r.campaignId).filter(Boolean)),
        ] as string[];
        const campaigns = campaignIds.length
            ? await prisma.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
            : [];
        const campaignName: Record<string, string> = {};
        campaigns.forEach((c: any) => (campaignName[c.id] = c.name));

        const events: any[] = [];

        // Lead created
        events.push({
            id: `created-${lead.id}`,
            kind: 'added',
            label: 'Added to Qampi',
            detail: null,
            channel: null,
            campaignName: null,
            status: 'SUCCESS',
            timestamp: lead.createdAt,
        });

        // Campaign actions (skip MESSAGE/EMAIL — Message rows own those)
        actions.forEach((a: any) => {
            const type = (a.actionType || '').toUpperCase();
            if (type === 'MESSAGE' || type === 'EMAIL') return;
            const map = TIMELINE_ACTION_LABELS[type] || {
                label: type ? type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()) : 'Action',
                kind: 'other',
            };
            events.push({
                id: `action-${a.id}`,
                kind: map.kind,
                label: map.label,
                detail: a.status === 'FAILED' ? (a.errorMessage || 'Failed') : null,
                channel: null,
                campaignName: a.campaignId ? campaignName[a.campaignId] || null : null,
                status: a.status,
                timestamp: a.executedAt,
            });
        });

        // Messages (sends + replies, LinkedIn + email)
        messages.forEach((m: any) => {
            const isIn = m.direction === 'RECEIVED';
            const isEmail = m.channel === 'email';
            events.push({
                id: `msg-${m.id}`,
                kind: isIn ? 'message_in' : 'message_out',
                label: isIn
                    ? (isEmail ? 'Email reply received' : 'Reply received')
                    : (isEmail ? 'Email sent' : 'Message sent'),
                detail: m.content || null,
                channel: m.channel,
                campaignName: m.campaignId ? campaignName[m.campaignId] || null : null,
                status: 'SUCCESS',
                timestamp: m.sentAt,
            });
        });

        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({ leadId: lead.id, events });
    } catch (error) {
        console.error('Error building lead timeline:', error);
        res.status(500).json({ error: 'Failed to load activity timeline' });
    }
};

// ── Ready for follow-up ──────────────────────────────────────────────────────
// Surfaces leads that earned a follow-up, in two segments computed from the
// Message log (no new table). The user enrolls them into a follow-up campaign
// from the Follow-ups page — Qampi never asks them to follow up by hand.
//   • replied   = they answered once, you have NOT replied since, and it's been
//                 quiet for > repliedDays.
//   • no_reply  = you messaged them, they NEVER answered, last touch > noReplyDays.
// Leads mid-flight in a campaign (PENDING/IN_PROGRESS/DEFERRED) are excluded so
// we never suggest re-touching someone an active sequence is already handling.
export const getFollowUpLeads = async (req: any, res: Response) => {
    const userId = req.user.id;
    const repliedDays = Math.max(0, parseInt(req.query.repliedDays as string) || 3);
    const noReplyDays = Math.max(0, parseInt(req.query.noReplyDays as string) || 5);

    try {
        const teamIds = await getTeamUserIds(userId);
        const allowedIds = teamIds.length ? teamIds : [userId];
        const now = Date.now();

        const [messages, activeProgress] = await Promise.all([
            prisma.message.findMany({
                where: { userId: { in: allowedIds } },
                select: { leadId: true, direction: true, sentAt: true },
                orderBy: { sentAt: 'asc' },
            }),
            prisma.campaignLeadProgress.findMany({
                where: { status: { in: ['PENDING', 'IN_PROGRESS', 'DEFERRED'] } },
                select: { leadId: true },
            }),
        ]);

        const busy = new Set(activeProgress.map((p: any) => p.leadId));

        // Reduce the message log to per-lead inbound/outbound signals.
        type Sig = { lastInbound: number | null; lastOutbound: number | null; hasInbound: boolean; hasOutbound: boolean };
        const sig: Record<string, Sig> = {};
        messages.forEach((m: any) => {
            const s = (sig[m.leadId] ||= { lastInbound: null, lastOutbound: null, hasInbound: false, hasOutbound: false });
            const t = new Date(m.sentAt).getTime();
            if (m.direction === 'RECEIVED') { s.hasInbound = true; s.lastInbound = Math.max(s.lastInbound ?? 0, t); }
            else { s.hasOutbound = true; s.lastOutbound = Math.max(s.lastOutbound ?? 0, t); }
        });

        const repliedIds: string[] = [];
        const noReplyIds: string[] = [];
        const dayMs = 24 * 60 * 60 * 1000;

        for (const [leadId, s] of Object.entries(sig)) {
            if (busy.has(leadId)) continue;
            if (s.hasInbound) {
                // Replied — only if we haven't already answered since their last reply.
                const answeredSince = s.lastOutbound != null && s.lastInbound != null && s.lastOutbound > s.lastInbound;
                if (!answeredSince && s.lastInbound != null && now - s.lastInbound > repliedDays * dayMs) {
                    repliedIds.push(leadId);
                }
            } else if (s.hasOutbound && s.lastOutbound != null && now - s.lastOutbound > noReplyDays * dayMs) {
                noReplyIds.push(leadId);
            }
        }

        const allIds = [...repliedIds, ...noReplyIds];
        const leads = allIds.length
            ? await prisma.lead.findMany({
                where: { id: { in: allIds }, userId: { in: allowedIds } },
                select: {
                    id: true, firstName: true, lastName: true, jobTitle: true, company: true,
                    linkedinUrl: true, status: true, connectionDegree: true,
                },
            })
            : [];
        const leadById: Record<string, any> = {};
        leads.forEach((l: any) => (leadById[l.id] = l));

        const decorate = (ids: string[], segment: 'replied' | 'no_reply') =>
            ids
                .map((id) => {
                    const l = leadById[id];
                    if (!l) return null;
                    const last = segment === 'replied' ? sig[id].lastInbound : sig[id].lastOutbound;
                    return { ...l, segment, lastActivityAt: last ? new Date(last).toISOString() : null };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => (a.lastActivityAt || '').localeCompare(b.lastActivityAt || ''));

        const replied = decorate(repliedIds, 'replied');
        const noReply = decorate(noReplyIds, 'no_reply');

        res.json({
            replied,
            noReply,
            counts: { replied: replied.length, noReply: noReply.length, total: replied.length + noReply.length },
            thresholds: { repliedDays, noReplyDays },
        });
    } catch (error) {
        console.error('Error building follow-up list:', error);
        res.status(500).json({ error: 'Failed to load follow-up leads' });
    }
};
