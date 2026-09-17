#!/usr/bin/env node
/**
 * Qampi MCP server.
 *
 * Exposes Qampi's LinkedIn automation as MCP tools, so an agent in Claude Code,
 * Codex, Cursor — or anything else that speaks MCP — can make LinkedIn one node
 * in a larger pipeline: research a prospect in the editor, add them to Qampi,
 * enroll them in a sequence, and read back what happened.
 *
 * It is a thin client over the public REST API (/api/public/v1) and holds no
 * LinkedIn credentials of its own: the user's API key authenticates, and every
 * safety rule — daily/weekly caps, the invite ramp, action pacing, the
 * outstanding-invite ceiling — is enforced server-side, where it belongs. An
 * agent cannot talk its way past a cap by calling a tool differently.
 *
 * SAFETY POSTURE. The default mode is READ-ONLY, and write tools are not
 * registered at all in that mode — an agent cannot call a tool it cannot see,
 * which is a stronger guarantee than asking it nicely not to. Writes require
 * QAMPI_MODE=full, and the one tool that actually starts outreach to real
 * people additionally requires an explicit confirm flag.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_KEY = process.env.QAMPI_API_KEY || '';
const BASE_URL = (process.env.QAMPI_BASE_URL || 'https://api.qampi.com/api/public/v1').replace(/\/$/, '');
const MODE = (process.env.QAMPI_MODE || 'read-only').toLowerCase();
const WRITES_ENABLED = MODE === 'full' || MODE === 'write';
const TIMEOUT_MS = Number(process.env.QAMPI_TIMEOUT_MS || 60_000);

if (!API_KEY) {
    // stderr, never stdout: stdout is the JSON-RPC channel and any stray byte
    // there corrupts the protocol.
    console.error('[qampi-mcp] QAMPI_API_KEY is not set. Create a key in Qampi → Settings → API keys.');
    process.exit(1);
}

type Json = Record<string, any>;

/**
 * One HTTP call to the public API.
 *
 * Errors come back as readable text rather than thrown stack traces, because
 * the consumer is a language model: "UPGRADE_REQUIRED: API access is available
 * on the Pro and Business plans" is actionable, an ECONNRESET trace is not.
 */
async function call(method: string, path: string, body?: Json): Promise<Json> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: {
                'X-API-Key': API_KEY,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        const text = await res.text();
        let data: Json;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

        if (!res.ok) {
            const code = data.error || `HTTP_${res.status}`;
            const message = data.message || text.slice(0, 300) || res.statusText;
            // Surface the two states an agent can actually do something about.
            const hint =
                code === 'ONBOARDING_INCOMPLETE' ? ' — finish onboarding at app.qampi.com first.'
                : code === 'UPGRADE_REQUIRED' ? ' — this needs a Pro or Business plan.'
                : code === 'RATE_LIMITED' ? ' — wait a minute and retry.'
                : '';
            throw new Error(`${code}: ${message}${hint}`);
        }
        return data;
    } catch (err: any) {
        if (err?.name === 'AbortError') throw new Error(`TIMEOUT: ${method} ${path} took longer than ${TIMEOUT_MS}ms.`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/** MCP content payload. JSON so the model can read fields, not prose. */
const ok = (data: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const server = new McpServer({ name: 'qampi', version: '0.1.0' });

// ── Read tools ───────────────────────────────────────────────────────────────

server.registerTool('qampi_status', {
    title: 'Qampi account status',
    description:
        'Whether the Qampi account is usable right now: LinkedIn connection state, account health, plan, '
        + 'and TODAY\'S REMAINING BUDGET for invites/messages/searches. Call this before planning outreach — '
        + 'the invite allowance is not a fixed number, it ramps with account age and acceptance rate.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
}, async () => {
    const [me, usage] = await Promise.all([call('GET', '/me'), call('GET', '/usage')]);
    return ok({ account: me, usage, mode: MODE });
});

server.registerTool('qampi_list_templates', {
    title: 'List campaign templates',
    description: 'Prebuilt outreach sequences. Use a template id with qampi_create_campaign.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
}, async () => ok(await call('GET', '/templates')));

server.registerTool('qampi_list_leads', {
    title: 'List leads',
    description: 'Leads in the Qampi account, newest first.',
    inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Default 25.'),
        offset: z.number().int().min(0).optional(),
        status: z.string().optional().describe('Filter by lead status, e.g. IMPORTED, PENDING, CONNECTED, REPLIED.'),
    },
    annotations: { readOnlyHint: true },
}, async ({ limit, offset, status }) => {
    const q = new URLSearchParams();
    if (limit) q.set('limit', String(limit));
    if (offset) q.set('offset', String(offset));
    if (status) q.set('status', status);
    return ok(await call('GET', `/leads${q.toString() ? `?${q}` : ''}`));
});

server.registerTool('qampi_get_lead', {
    title: 'Get a lead',
    description: 'One lead with its enrichment and current status.',
    inputSchema: { leadId: z.string().describe('Qampi lead id.') },
    annotations: { readOnlyHint: true },
}, async ({ leadId }) => ok(await call('GET', `/leads/${encodeURIComponent(leadId)}`)));

server.registerTool('qampi_list_campaigns', {
    title: 'List campaigns',
    inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    annotations: { readOnlyHint: true },
}, async ({ limit }) => ok(await call('GET', `/campaigns${limit ? `?limit=${limit}` : ''}`)));

server.registerTool('qampi_get_campaign', {
    title: 'Get a campaign',
    description: 'Campaign configuration and progress.',
    inputSchema: { campaignId: z.string() },
    annotations: { readOnlyHint: true },
}, async ({ campaignId }) => ok(await call('GET', `/campaigns/${encodeURIComponent(campaignId)}`)));

server.registerTool('qampi_campaign_leads', {
    title: 'List a campaign\'s leads',
    description: 'Per-lead progress within a campaign — who is pending, connected, replied, or parked.',
    inputSchema: { campaignId: z.string(), limit: z.number().int().min(1).max(100).optional() },
    annotations: { readOnlyHint: true },
}, async ({ campaignId, limit }) =>
    ok(await call('GET', `/campaigns/${encodeURIComponent(campaignId)}/leads${limit ? `?limit=${limit}` : ''}`)));

server.registerTool('qampi_search_people', {
    title: 'Search LinkedIn people',
    description:
        'Search LinkedIn through the connected account. COSTS one search from the monthly budget (LinkedIn\'s '
        + 'commercial-use limit), so prefer one well-built query over several exploratory ones. Returns up to 10 per page.',
    inputSchema: {
        keywords: z.string().describe('Plain keywords, e.g. "head of growth fintech". Boolean operators are not supported.'),
        title: z.string().optional(),
        location: z.string().optional(),
        degrees: z.array(z.number().int().min(1).max(3)).optional().describe('Connection degrees to include, e.g. [2,3].'),
        page: z.number().int().min(1).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ keywords, title, location, degrees, page }) => ok(await call('POST', '/search/people', {
    keywords,
    filters: { ...(title ? { title } : {}), ...(location ? { location } : {}), ...(degrees ? { degrees } : {}) },
    ...(page ? { page } : {}),
})));

// ── Write tools (QAMPI_MODE=full only) ───────────────────────────────────────
//
// Not registered in read-only mode: an agent cannot call a tool it cannot see.

if (WRITES_ENABLED) {
    server.registerTool('qampi_add_leads', {
        title: 'Add leads',
        description: 'Add leads to Qampi. Does NOT contact anyone — it only puts them in the database.',
        inputSchema: {
            leads: z.array(z.object({
                linkedinUrl: z.string().describe('Full LinkedIn profile URL. Required — it is the identity key.'),
                firstName: z.string().optional(),
                lastName: z.string().optional(),
                jobTitle: z.string().optional(),
                company: z.string().optional(),
                location: z.string().optional(),
                email: z.string().optional(),
            })).min(1).max(100),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, async ({ leads }) => ok(await call('POST', '/leads', { leads })));

    server.registerTool('qampi_annotate_lead', {
        title: 'Tag or note a lead',
        description:
            'Set tags or a free-text note on a lead. Only tags and notes are writable — enrichment fields are '
            + 'written by Qampi\'s profile visits, and lead status is derived by the engine.',
        inputSchema: {
            leadId: z.string(),
            tags: z.array(z.string()).optional().describe('Replaces the existing tag set.'),
            info: z.string().optional().describe('Free-text note.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async ({ leadId, tags, info }) => ok(await call('PATCH', `/leads/${encodeURIComponent(leadId)}`, {
        ...(tags ? { tags } : {}), ...(info !== undefined ? { info } : {}),
    })));

    server.registerTool('qampi_create_campaign', {
        title: 'Create a campaign from a template',
        description: 'Creates a campaign in DRAFT. Nothing is sent until qampi_launch_campaign is called.',
        inputSchema: {
            templateId: z.string().describe('From qampi_list_templates.'),
            name: z.string(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async ({ templateId, name }) => ok(await call('POST', '/campaigns/from-template', { templateId, name })));

    server.registerTool('qampi_enroll_leads', {
        title: 'Enroll leads in a campaign',
        description: 'Adds existing leads to a campaign. Still sends nothing — launching is a separate step.',
        inputSchema: { campaignId: z.string(), leadIds: z.array(z.string()).min(1).max(500) },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, async ({ campaignId, leadIds }) =>
        ok(await call('POST', `/campaigns/${encodeURIComponent(campaignId)}/leads`, { leadIds })));

    server.registerTool('qampi_launch_campaign', {
        title: 'Launch a campaign',
        description:
            'STARTS REAL OUTREACH to real people from the connected LinkedIn account: profile visits, invitations, '
            + 'messages, as configured in the campaign. This is not reversible — a sent invitation cannot be unsent, '
            + 'and a withdrawn one cannot be resent for three weeks. Confirm with the human first, then pass confirm: true. '
            + 'Qampi still applies its own daily/weekly caps, pacing and ramp on top.',
        inputSchema: {
            campaignId: z.string(),
            confirm: z.literal(true).describe('Must be true, and should reflect an explicit human go-ahead.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    }, async ({ campaignId }) => ok(await call('POST', `/campaigns/${encodeURIComponent(campaignId)}/launch`, {})));

    server.registerTool('qampi_find_email', {
        title: 'Find a work email',
        description: 'Finds and verifies a work email. Consumes one email-finder credit per lookup.',
        inputSchema: {
            firstName: z.string(), lastName: z.string(),
            company: z.string().optional(), companyDomain: z.string().optional(), jobTitle: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, async (args) => ok(await call('POST', '/enrich/email', args)));

    server.registerTool('qampi_register_webhook', {
        title: 'Register a webhook',
        description:
            'Subscribe a URL to Qampi lifecycle events (lead.connected, lead.replied, …) so a pipeline can react '
            + 'to outreach outcomes instead of polling.',
        inputSchema: {
            url: z.string().describe('HTTPS endpoint that will receive POSTs.'),
            events: z.array(z.string()).min(1).describe('Event names; list them with qampi_status → see docs.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async ({ url, events }) => ok(await call('POST', '/webhooks', { url, events })));
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[qampi-mcp] ready — ${BASE_URL} (mode: ${WRITES_ENABLED ? 'full' : 'read-only'})`);
