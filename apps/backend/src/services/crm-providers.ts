import { prisma } from '@repo/db';
import { decrypt } from '../utils/crypto';
import type { CrmEventType } from './crm-events';

// Per-provider, per-event mapping. Each handler receives the lead record,
// the policy row, the event context, and the provider's credentials, and
// returns a result object the worker persists to CrmSyncEvent.
//
// Conventions:
// - Always upsert by email (HubSpot/Pipedrive). lead.added is the only event
//   that creates the contact; later events PATCH the same record.
// - Never throw — return `{success: false, error}`. Throwing would put the
//   BullMQ job in retry, which we don't want for "this lead has no email" or
//   "user has no token" — those are skips, not retries.
// - Auth failures (401/403) ARE thrown so BullMQ retries with backoff — those
//   usually mean an expired token that the user has to rotate.

export interface ProviderResult {
    success: boolean;
    externalId?: string;
    error?: string;
    skipped?: boolean;
    skippedReason?: string;
}

export interface ProviderContext {
    event: CrmEventType;
    userId: string;
    campaignId: string;
    lead: {
        id: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        jobTitle: string | null;
        company: string | null;
        location: string | null;
        linkedinUrl: string;
        headline: string | null;
    };
    campaign: { id: string; name: string };
    policy: {
        createTaskOnReply: boolean;
        ownerEmail: string | null;
    };
    meta?: Record<string, any>;
}

const HS_LIFECYCLE: Record<CrmEventType, string | null> = {
    'lead.added':     'subscriber',
    'lead.connected': 'lead',
    'lead.messaged':  null,
    'lead.replied':   'marketingqualifiedlead',
    'lead.bounced':   null,
    'lead.completed': null,
};

function fullName(l: ProviderContext['lead']): string {
    return `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'LinkedIn Contact';
}

function noteBodyFor(ctx: ProviderContext): string {
    const c = ctx.campaign.name;
    switch (ctx.event) {
        case 'lead.added':
            return `Added to Qampi campaign: ${c}`;
        case 'lead.connected':
            return `Accepted connection · campaign: ${c}`;
        case 'lead.messaged':
            return `Sent AI message · campaign: ${c}\n\n${ctx.meta?.messageContent || ''}`;
        case 'lead.replied':
            return `Lead replied · campaign: ${c}\n\nReply:\n${ctx.meta?.replyContent || '(content not captured)'}`;
        case 'lead.bounced':
            return `Email bounced · campaign: ${c}${ctx.meta?.reason ? ` · ${ctx.meta.reason}` : ''}`;
        case 'lead.completed':
            return `Campaign exhausted with no reply · campaign: ${c}`;
    }
}

// ─── HubSpot ────────────────────────────────────────────────────────────────

export async function syncHubSpot(
    token: string,
    ctx: ProviderContext,
): Promise<ProviderResult> {
    if (!ctx.lead.email) {
        return { success: true, skipped: true, skippedReason: 'no email' };
    }
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    // Only stock HubSpot properties — custom properties like qampi_campaign
    // would need to be pre-created in the user's portal, which we can't
    // assume. Campaign context still flows via the Note attached below.
    const properties: Record<string, any> = {
        email: ctx.lead.email,
        firstname: ctx.lead.firstName || undefined,
        lastname: ctx.lead.lastName || undefined,
        phone: ctx.lead.phone || undefined,
        website: ctx.lead.linkedinUrl,
        jobtitle: ctx.lead.jobTitle || undefined,
        company: ctx.lead.company || undefined,
        address: ctx.lead.location || undefined,
    };
    const stage = HS_LIFECYCLE[ctx.event];
    if (stage) properties.lifecyclestage = stage;
    if (ctx.event === 'lead.bounced') properties.hs_email_invalid = true;

    // Step 1 — upsert contact (CREATE → 409 → PATCH).
    let contactId: string | null = null;
    let res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties }),
    });
    if (res.status === 409) {
        const txt = await res.text();
        const m = txt.match(/Existing ID:\s*(\d+)/);
        if (!m) return { success: false, error: `HS 409 no id: ${txt}` };
        contactId = m[1];
        res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties }),
        });
    }
    if (res.status === 401 || res.status === 403) {
        throw new Error(`HubSpot auth failed: ${res.status}`);
    }
    if (!res.ok) {
        return { success: false, error: `HS ${res.status}: ${await res.text()}` };
    }
    if (!contactId) {
        const body = await res.json();
        contactId = body.id;
    }

    // Step 2 — append a note (engagement) for state-change events.
    const note = noteBodyFor(ctx);
    await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            properties: {
                hs_note_body: note,
                hs_timestamp: Date.now(),
            },
            associations: [
                {
                    to: { id: contactId },
                    types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
                },
            ],
        }),
    }).catch(err => console.error(`[CRM-HS] note write failed: ${err.message}`));

    // Step 3 — on reply, create a task if policy says so.
    if (ctx.event === 'lead.replied' && ctx.policy.createTaskOnReply) {
        const due = Date.now() + 24 * 60 * 60 * 1000;
        await fetch('https://api.hubapi.com/crm/v3/objects/tasks', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                properties: {
                    hs_task_subject: `Follow up with ${fullName(ctx.lead)} — replied to ${ctx.campaign.name}`,
                    hs_task_body: ctx.meta?.replyContent || 'Lead replied via Qampi outreach.',
                    hs_task_status: 'NOT_STARTED',
                    hs_task_priority: 'HIGH',
                    hs_timestamp: due,
                    hs_task_type: 'TODO',
                },
                associations: [
                    {
                        to: { id: contactId },
                        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
                    },
                ],
            }),
        }).catch(err => console.error(`[CRM-HS] task write failed: ${err.message}`));
    }

    return { success: true, externalId: contactId || undefined };
}

// ─── Pipedrive ──────────────────────────────────────────────────────────────

export async function syncPipedrive(
    token: string,
    ctx: ProviderContext,
): Promise<ProviderResult> {
    const baseUrl = `https://api.pipedrive.com/v1`;

    // 1) Upsert person. Pipedrive search by email returns existing ID.
    let personId: number | null = null;
    if (ctx.lead.email) {
        const sres = await fetch(
            `${baseUrl}/persons/search?term=${encodeURIComponent(ctx.lead.email)}&fields=email&exact_match=true&api_token=${token}`,
        );
        if (sres.status === 401 || sres.status === 403) {
            throw new Error(`Pipedrive auth failed: ${sres.status}`);
        }
        if (sres.ok) {
            const j = await sres.json();
            personId = j?.data?.items?.[0]?.item?.id ?? null;
        }
    }

    const body: Record<string, any> = {
        name: fullName(ctx.lead),
        email: ctx.lead.email ? [{ value: ctx.lead.email, primary: true }] : undefined,
        phone: ctx.lead.phone ? [{ value: ctx.lead.phone, primary: true }] : undefined,
        job_title: ctx.lead.jobTitle || undefined,
    };

    if (personId == null) {
        const res = await fetch(`${baseUrl}/persons?api_token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) return { success: false, error: `PD ${res.status}: ${await res.text()}` };
        const j = await res.json();
        personId = j?.data?.id ?? null;
    } else {
        await fetch(`${baseUrl}/persons/${personId}?api_token=${token}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).catch(() => {});
    }

    if (!personId) return { success: false, error: 'PD: no person id resolved' };

    // 2) Add a note/activity for the event.
    const noteContent = noteBodyFor(ctx);
    await fetch(`${baseUrl}/notes?api_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent, person_id: personId }),
    }).catch(err => console.error(`[CRM-PD] note write failed: ${err.message}`));

    // 3) On reply, create a task-style activity.
    if (ctx.event === 'lead.replied' && ctx.policy.createTaskOnReply) {
        const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await fetch(`${baseUrl}/activities?api_token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: `Follow up with ${fullName(ctx.lead)} — replied to ${ctx.campaign.name}`,
                type: 'task',
                due_date: due.toISOString().slice(0, 10),
                person_id: personId,
                note: ctx.meta?.replyContent || 'Lead replied via Qampi outreach.',
            }),
        }).catch(err => console.error(`[CRM-PD] task write failed: ${err.message}`));
    }

    return { success: true, externalId: String(personId) };
}

// ─── Notion ─────────────────────────────────────────────────────────────────

const NOTION_STATUS: Record<CrmEventType, string> = {
    'lead.added':     'Prospecting',
    'lead.connected': 'Connected',
    'lead.messaged':  'Messaged',
    'lead.replied':   'Replied',
    'lead.bounced':   'Bounced',
    'lead.completed': 'No response',
};

export async function syncNotion(
    token: string,
    databaseId: string,
    ctx: ProviderContext,
): Promise<ProviderResult> {
    const headers = {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
    };

    // Find existing row by linkedinUrl (stable, always present).
    const q = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            filter: { property: 'LinkedIn', url: { equals: ctx.lead.linkedinUrl } },
            page_size: 1,
        }),
    });
    if (q.status === 401 || q.status === 403) throw new Error(`Notion auth failed: ${q.status}`);

    let pageId: string | null = null;
    if (q.ok) {
        const j = await q.json();
        pageId = j?.results?.[0]?.id ?? null;
    }

    const properties: Record<string, any> = {
        Name: { title: [{ text: { content: fullName(ctx.lead) } }] },
        Status: { select: { name: NOTION_STATUS[ctx.event] } },
    };
    if (ctx.lead.email) properties.Email = { email: ctx.lead.email };
    if (ctx.lead.company) properties.Company = { rich_text: [{ text: { content: ctx.lead.company } }] };
    properties.LinkedIn = { url: ctx.lead.linkedinUrl };
    if (ctx.event === 'lead.replied' && ctx.policy.createTaskOnReply) {
        properties['Needs follow-up'] = { checkbox: true };
    }

    if (pageId) {
        const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties }),
        });
        if (!res.ok) return { success: false, error: `Notion patch ${res.status}: ${await res.text()}` };
    } else {
        const res = await fetch(`https://api.notion.com/v1/pages`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
        });
        if (!res.ok) return { success: false, error: `Notion create ${res.status}: ${await res.text()}` };
        const j = await res.json();
        pageId = j?.id ?? null;
    }

    // Append a comment block with the event narration.
    if (pageId) {
        await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{ type: 'text', text: { content: noteBodyFor(ctx) } }],
                        },
                    },
                ],
            }),
        }).catch(err => console.error(`[CRM-NT] block append failed: ${err.message}`));
    }

    return { success: true, externalId: pageId || undefined };
}

// ─── Orchestration ──────────────────────────────────────────────────────────

export async function runProvidersForEvent(
    userId: string,
    ctx: ProviderContext,
): Promise<Array<{ provider: string; result: ProviderResult }>> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const results: Array<{ provider: string; result: ProviderResult }> = [];

    const decryptSafe = (v: string | null): string | null => {
        if (!v) return null;
        try { return decrypt(v); } catch { return null; }
    };
    const hs = decryptSafe(user.hubspotToken);
    const pd = decryptSafe(user.pipedriveToken);
    const nt = decryptSafe(user.notionToken);
    const ntDb = decryptSafe(user.notionDatabaseId);

    if (hs) {
        try {
            results.push({ provider: 'hubspot', result: await syncHubSpot(hs, ctx) });
        } catch (err: any) {
            results.push({ provider: 'hubspot', result: { success: false, error: err.message } });
        }
    }
    if (pd) {
        try {
            results.push({ provider: 'pipedrive', result: await syncPipedrive(pd, ctx) });
        } catch (err: any) {
            results.push({ provider: 'pipedrive', result: { success: false, error: err.message } });
        }
    }
    if (nt && ntDb) {
        try {
            results.push({ provider: 'notion', result: await syncNotion(nt, ntDb, ctx) });
        } catch (err: any) {
            results.push({ provider: 'notion', result: { success: false, error: err.message } });
        }
    }

    return results;
}
