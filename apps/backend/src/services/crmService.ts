import { prisma } from '@repo/db';
import { decrypt } from '../utils/crypto';

interface SyncResult {
    provider: 'hubspot' | 'pipedrive' | 'notion';
    success: boolean;
    error?: string;
}

/**
 * Synchronizes a lead to HubSpot and Pipedrive in parallel if the user has configured
 * the corresponding API keys. Logs successes/failures to the ActionLog database table.
 */
export async function syncLeadToCRMs(userId: string, leadId: string): Promise<SyncResult[]> {
    console.log(`[CRM-SERVICE] Starting CRM sync for user ${userId}, lead ${leadId}`);

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        throw new Error(`User not found: ${userId}`);
    }

    const lead = await prisma.lead.findUnique({
        where: { id: leadId }
    });

    if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
    }

    // Decrypt credentials if set
    let hubspotToken: string | null = null;
    let pipedriveToken: string | null = null;
    let notionToken: string | null = null;
    let notionDatabaseId: string | null = null;

    if (user.hubspotToken) {
        try {
            hubspotToken = decrypt(user.hubspotToken);
        } catch (e: any) {
            console.error(`[CRM-SERVICE] Failed to decrypt HubSpot token: ${e.message}`);
        }
    }

    if (user.pipedriveToken) {
        try {
            pipedriveToken = decrypt(user.pipedriveToken);
        } catch (e: any) {
            console.error(`[CRM-SERVICE] Failed to decrypt Pipedrive token: ${e.message}`);
        }
    }

    if (user.notionToken) {
        try {
            notionToken = decrypt(user.notionToken);
        } catch (e: any) {
            console.error(`[CRM-SERVICE] Failed to decrypt Notion token: ${e.message}`);
        }
    }

    if (user.notionDatabaseId) {
        try {
            notionDatabaseId = decrypt(user.notionDatabaseId);
        } catch (e: any) {
            console.error(`[CRM-SERVICE] Failed to decrypt Notion Database ID: ${e.message}`);
        }
    }

    if (!hubspotToken && !pipedriveToken && (!notionToken || !notionDatabaseId)) {
        console.log(`[CRM-SERVICE] No CRM tokens configured for user ${userId}. Skipping sync.`);
        return [];
    }

    const syncPromises: Promise<SyncResult>[] = [];

    // 1. HubSpot Sync
    if (hubspotToken) {
        syncPromises.push((async (): Promise<SyncResult> => {
            try {
                console.log(`[CRM-SERVICE] Syncing lead ${leadId} to HubSpot...`);
                const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hubspotToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        properties: {
                            email: lead.email || undefined,
                            firstname: lead.firstName || undefined,
                            lastname: lead.lastName || undefined,
                            website: lead.linkedinUrl || undefined,
                            jobtitle: lead.jobTitle || undefined,
                            company: lead.company || undefined,
                            address: lead.location || undefined
                        }
                    })
                });

                if (!response.ok) {
                    const responseText = await response.text();
                    throw new Error(`HubSpot API responded with status ${response.status}: ${responseText}`);
                }

                await prisma.actionLog.create({
                    data: {
                        userId,
                        leadId,
                        actionType: 'CRM_SYNC_HUBSPOT',
                        status: 'SUCCESS'
                    }
                });

                console.log(`[CRM-SERVICE] HubSpot sync successful for lead ${leadId}`);
                return { provider: 'hubspot', success: true };
            } catch (err: any) {
                console.error(`[CRM-SERVICE] HubSpot sync failed for lead ${leadId}: ${err.message}`);
                await prisma.actionLog.create({
                    data: {
                        userId,
                        leadId,
                        actionType: 'CRM_SYNC_HUBSPOT',
                        status: 'FAILED',
                        errorMessage: err.message
                    }
                });
                return { provider: 'hubspot', success: false, error: err.message };
            }
        })());
    }

    // 2. Pipedrive Sync
    if (pipedriveToken) {
        syncPromises.push((async (): Promise<SyncResult> => {
            try {
                console.log(`[CRM-SERVICE] Syncing lead ${leadId} to Pipedrive...`);
                const response = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${pipedriveToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    // Pipedrive's `org_id` expects an integer ID of an existing
                    // organization — not a `{name}` object. Creating an org by
                    // name requires a separate POST /v1/organizations call first.
                    // Skipping the org link until we wire that flow.
                    body: JSON.stringify({
                        name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'LinkedIn Contact',
                        email: lead.email ? [{ value: lead.email, primary: true }] : undefined,
                    })
                });

                if (!response.ok) {
                    const responseText = await response.text();
                    throw new Error(`Pipedrive API responded with status ${response.status}: ${responseText}`);
                }

                await prisma.actionLog.create({
                    data: {
                        userId,
                        leadId,
                        actionType: 'CRM_SYNC_PIPEDRIVE',
                        status: 'SUCCESS'
                    }
                });

                console.log(`[CRM-SERVICE] Pipedrive sync successful for lead ${leadId}`);
                return { provider: 'pipedrive', success: true };
            } catch (err: any) {
                console.error(`[CRM-SERVICE] Pipedrive sync failed for lead ${leadId}: ${err.message}`);
                await prisma.actionLog.create({
                    data: {
                        userId,
                        leadId,
                        actionType: 'CRM_SYNC_PIPEDRIVE',
                        status: 'FAILED',
                        errorMessage: err.message
                    }
                });
                return { provider: 'pipedrive', success: false, error: err.message };
            }
        })());
    }

    // 3. Notion Sync
    if (notionToken && notionDatabaseId) {
        syncPromises.push((async (): Promise<SyncResult> => {
            try {
                console.log(`[CRM-SERVICE] Syncing lead ${leadId} to Notion...`);
                const prospectName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'LinkedIn Contact';
                const prospectEmail = lead.email || null;
                const prospectCompany = lead.company || '';

                const response = await fetch('https://api.notion.com/v1/pages', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${notionToken}`,
                        'Notion-Version': '2022-06-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        parent: { database_id: notionDatabaseId },
                        properties: {
                            Name: { title: [{ text: { content: prospectName } }] },
                            Email: { email: prospectEmail },
                            Company: { rich_text: [{ text: { content: prospectCompany } }] },
                            Status: { select: { name: 'Replied' } }
                        }
                    })
                });

                if (!response.ok) {
                    const responseText = await response.text();
                    throw new Error(`Notion API responded with status ${response.status}: ${responseText}`);
                }

                await prisma.actionLog.create({
                    data: {
                        userId,
                        leadId,
                        actionType: 'CRM_SYNC_NOTION',
                        status: 'SUCCESS'
                    }
                });

                console.log(`[CRM-SERVICE] Notion sync successful for lead ${leadId}`);
                return { provider: 'notion', success: true };
            } catch (err: any) {
                console.error(`[CRM-SERVICE] Notion sync failed for lead ${leadId}: ${err.message}`);
                await prisma.actionLog.create({
                    data: {
                        userId,
                        leadId,
                        actionType: 'CRM_SYNC_NOTION',
                        status: 'FAILED',
                        errorMessage: err.message
                    }
                });
                return { provider: 'notion', success: false, error: err.message };
            }
        })());
    }

    return Promise.all(syncPromises);
}
