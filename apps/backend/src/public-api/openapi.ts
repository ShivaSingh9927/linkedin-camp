// OpenAPI 3.1 description of the Qampi public API. Served at
// GET /api/public/v1/openapi.json and rendered by Redoc at /api/public/v1/docs.
// Hand-maintained — keep in sync with routes/public-api.routes.ts + handlers.ts.

const Error = { $ref: '#/components/schemas/Error' };
const errResponses = {
    '400': { description: 'VALIDATION_ERROR', content: { 'application/json': { schema: Error } } },
    '401': { description: 'UNAUTHORIZED — missing/invalid/revoked key', content: { 'application/json': { schema: Error } } },
    '403': { description: 'UPGRADE_REQUIRED / ONBOARDING_INCOMPLETE', content: { 'application/json': { schema: Error } } },
    '409': { description: 'ACTIVE_CAMPAIGN_EXISTS / LINKEDIN_SESSION_EXPIRED / EMAIL_ACCOUNT_REQUIRED', content: { 'application/json': { schema: Error } } },
    '429': { description: 'QUOTA_EXCEEDED / RATE_LIMITED', content: { 'application/json': { schema: Error } } },
};
const okJson = (example: any, description = 'Success') => ({
    '200': { description, content: { 'application/json': { example } } },
});

export const openApiSpec: any = {
    openapi: '3.1.0',
    info: {
        title: 'Qampi Public API',
        version: '1.0.0',
        description: `Automate Qampi from **n8n, Zapier, Make**, or your own code.

## Authentication
Create a key in **Settings → API keys**, then send it as a Bearer token:

\`\`\`
Authorization: Bearer qampi_live_xxxxxxxx
\`\`\`

## Conventions
- **Lists** return \`{ data, total, limit, offset }\`; paginate with \`?limit=&offset=\` (limit ≤ 100).
- **Errors** return the HTTP status plus \`{ "error": "<CODE>", "message": "...", ...details }\`.
- **Rate limit**: 120 requests/minute per key (\`429 RATE_LIMITED\`).

## What every action needs
A request must pass, in order: valid key → onboarding complete → your plan includes API access → (for LinkedIn/email actions) a healthy LinkedIn session and, for email campaigns, a connected sending account → available quota. Each gate has its own error code:

| Code | Meaning |
|---|---|
| \`ONBOARDING_INCOMPLETE\` | Finish onboarding in Qampi first. |
| \`UPGRADE_REQUIRED\` | Your plan doesn't include this (API is Pro+). |
| \`LINKEDIN_SESSION_EXPIRED\` | Re-sync your LinkedIn account (see \`resyncUrl\`). |
| \`EMAIL_ACCOUNT_REQUIRED\` | Connect a sending email account (see \`connectUrl\`). |
| \`ACTIVE_CAMPAIGN_EXISTS\` | You already have a running campaign. |
| \`LEAD_CAP_EXCEEDED\` | Over your plan's stored-lead cap. |
| \`QUOTA_EXCEEDED\` | Plan quota spent (invites/search/email); see \`resetAt\`. |

## Campaigns are template-based
You don't author workflows via the API. List templates, then create a campaign from one with your content (objective/tone/cta) — optionally launching it in the same call.

## Triggers (webhooks)
Register a webhook to receive events (\`lead.replied\`, \`lead.connected\`, …). Each delivery is signed — verify \`X-Qampi-Signature: sha256=HMAC(secret, rawBody)\`. See the **Webhooks** section.`,
    },
    servers: [
        { url: '{baseUrl}/api/public/v1', variables: { baseUrl: { default: 'https://app.qampi.ai' } } },
    ],
    security: [{ ApiKeyAuth: [] }],
    tags: [
        { name: 'Account' }, { name: 'Templates' }, { name: 'Campaigns' },
        { name: 'Leads' }, { name: 'Search & Enrich' }, { name: 'Webhooks' },
    ],
    components: {
        securitySchemes: {
            ApiKeyAuth: { type: 'http', scheme: 'bearer', description: 'Your `qampi_live_…` API key.' },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string', example: 'QUOTA_EXCEEDED' },
                    message: { type: 'string' },
                    resetAt: { type: 'string', format: 'date-time', nullable: true },
                },
                required: ['error', 'message'],
            },
            Lead: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    firstName: { type: 'string', nullable: true },
                    lastName: { type: 'string', nullable: true },
                    jobTitle: { type: 'string', nullable: true },
                    company: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    linkedinUrl: { type: 'string', nullable: true },
                    email: { type: 'string', nullable: true },
                    connectionDegree: { type: 'integer', nullable: true },
                    status: { type: 'string', enum: ['IMPORTED', 'PENDING', 'CONNECTED', 'REPLIED', 'BOUNCED'] },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
        },
    },
    paths: {
        '/me': {
            get: {
                tags: ['Account'], summary: 'Who am I',
                description: 'Identity, plan, onboarding status, and LinkedIn session health. Works even before onboarding is complete, so you can diagnose blocks.',
                responses: { ...okJson({ id: 'usr_1', email: 'you@co.com', tier: 'PRO', onboardingComplete: true, linkedin: { connected: true, health: 'HEALTHY' } }), ...errResponses },
            },
        },
        '/usage': {
            get: {
                tags: ['Account'], summary: 'Quota usage',
                description: 'Remaining invites/search/email credits with reset times. `cap: null` means unlimited. Email credits do not roll over.',
                responses: {
                    ...okJson({
                        invites: { used: 4, cap: 18, remaining: 14, period: 'daily', resetAt: '2026-09-03T00:00:00Z' },
                        monthlyInvites: { used: 40, cap: 300, remaining: 260, period: 'monthly', resetAt: '2026-10-01T00:00:00Z' },
                        search: { used: 12, cap: 280, remaining: 268, period: 'monthly', resetAt: '2026-10-01T00:00:00Z' },
                        emailCredits: { used: 30, cap: 300, remaining: 270, period: 'monthly', resetAt: '2026-10-01T00:00:00Z', rollover: false },
                        features: { api: true, multichannel: false, crmSync: true, team: true },
                    }), ...errResponses,
                },
            },
        },
        '/templates': {
            get: {
                tags: ['Templates'], summary: 'List campaign templates',
                description: 'Every template advertises its channels, required tier, whether it needs an email account or email credits, and its content fields.',
                responses: {
                    ...okJson({
                        data: [{ id: 'deep-linkedin-nurture', name: 'Deep LinkedIn Nurture', channels: ['linkedin'], requiredTier: 'PRO', requiresEmailAccount: false, requiresEmailCredits: false, durationDays: 21, steps: ['VISIT', 'CONNECT', 'MESSAGE', 'MESSAGE'] }],
                        total: 1,
                    }), ...errResponses,
                },
            },
        },
        '/templates/{id}': {
            get: {
                tags: ['Templates'], summary: 'Get a template',
                description: 'Includes `content` — the objective/tone/cta/description fields you can override (each with the template default).',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    ...okJson({ template: { id: 'deep-linkedin-nurture', name: 'Deep LinkedIn Nurture', channels: ['linkedin'], requiredTier: 'PRO', requiresEmailAccount: false, requiresEmailCredits: false, content: { objective: { required: false, default: 'Open a conversation…' }, tone: { required: false, default: 'professional' }, cta: { required: false, default: 'reply' }, description: { required: false, default: '…' } } } }),
                    ...errResponses,
                },
            },
        },
        '/campaigns': {
            get: {
                tags: ['Campaigns'], summary: 'List campaigns',
                parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }],
                responses: { ...okJson({ data: [{ id: 'cmp_1', name: 'Q1 founders', status: 'ACTIVE', leadCount: 42, createdAt: '2026-09-01T10:00:00Z' }], total: 1, limit: 25, offset: 0 }), ...errResponses },
            },
        },
        '/campaigns/from-template': {
            post: {
                tags: ['Campaigns'], summary: 'Create a campaign from a template',
                description: 'Template-only — a raw `workflow` is rejected. Unspecified content falls back to the template default. Set `launch: true` to enroll + start in one call (runs the launch prechecks).',
                requestBody: {
                    required: true,
                    content: { 'application/json': { example: { templateId: 'deep-linkedin-nurture', name: 'Q1 founders', objective: 'Book intro calls', tone: 'friendly', cta: 'reply', leadIds: ['led_1', 'led_2'], launch: true } } },
                },
                responses: { '201': { description: 'Created', content: { 'application/json': { example: { campaign: { id: 'cmp_1', name: 'Q1 founders', status: 'DRAFT' } } } } }, ...errResponses },
            },
        },
        '/campaigns/{id}': {
            get: {
                tags: ['Campaigns'], summary: 'Get a campaign (with funnel)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { ...okJson({ campaign: { id: 'cmp_1', name: 'Q1 founders', status: 'ACTIVE', objective: '…', funnel: { PENDING: 20, CONNECTED: 12, REPLIED: 3 } } }), ...errResponses },
            },
        },
        '/campaigns/{id}/leads': {
            get: {
                tags: ['Campaigns'], summary: 'List a campaign\'s leads',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { ...okJson({ data: [{ id: 'led_1', firstName: 'Ada', campaignStatus: 'CONNECTED' }], total: 1, limit: 25, offset: 0 }), ...errResponses },
            },
            post: {
                tags: ['Campaigns'], summary: 'Enroll leads into a campaign',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { example: { leadIds: ['led_1', 'led_2'] } } } },
                responses: { ...okJson({ enrolled: 2 }), ...errResponses },
            },
        },
        '/campaigns/{id}/launch': {
            post: {
                tags: ['Campaigns'], summary: 'Launch a campaign',
                description: 'Runs prechecks: LinkedIn session healthy, email account connected (for email campaigns), no other active campaign, lead cap. Launch is async — the engine paces execution within your daily/monthly limits.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { ...okJson({ ok: true }), ...errResponses },
            },
        },
        '/leads': {
            get: {
                tags: ['Leads'], summary: 'List leads',
                parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }],
                responses: { '200': { description: 'Success', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Lead' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } }, ...errResponses },
            },
            post: {
                tags: ['Leads'], summary: 'Create / import leads',
                description: 'Send a single lead object or `{ "leads": [...] }` (max 100). Deduplicated by LinkedIn URL — re-pushing an existing lead does not clobber enrichment.',
                requestBody: { required: true, content: { 'application/json': { example: { leads: [{ firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical Engines', linkedinUrl: 'https://linkedin.com/in/ada' }] } } } },
                responses: { '201': { description: 'Created', content: { 'application/json': { example: { data: [{ id: 'led_1', firstName: 'Ada' }], count: 1 } } } }, ...errResponses },
            },
        },
        '/leads/{id}': {
            get: {
                tags: ['Leads'], summary: 'Get a lead',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { '200': { description: 'Success', content: { 'application/json': { schema: { type: 'object', properties: { lead: { $ref: '#/components/schemas/Lead' } } } } } }, ...errResponses },
            },
            patch: {
                tags: ['Leads'], summary: 'Update lead tags / notes',
                description: 'Only `tags` and `info` (notes) are writable — lead **status** is derived by the engine and cannot be set via the API.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { example: { tags: ['vip', 'inbound'], info: 'Met at SaaStr' } } } },
                responses: { '200': { description: 'Success', content: { 'application/json': { schema: { type: 'object', properties: { lead: { $ref: '#/components/schemas/Lead' } } } } } }, ...errResponses },
            },
        },
        '/search/people': {
            post: {
                tags: ['Search & Enrich'], summary: 'Search LinkedIn people',
                description: 'Counts against your monthly search budget. Returns up to 10 per page.',
                requestBody: { required: true, content: { 'application/json': { example: { keywords: 'head of growth', filters: { title: 'Head of Growth', location: 'London', degrees: [2, 3] }, page: 1 } } } },
                responses: { ...okJson({ data: [{ firstName: 'Sam', lastName: 'R', headline: 'Head of Growth', linkedinUrl: 'https://linkedin.com/in/…', connectionDegree: 2 }], via: 'browserless', remaining: 267 }), ...errResponses },
            },
        },
        '/enrich/email': {
            post: {
                tags: ['Search & Enrich'], summary: 'Find an email',
                description: 'Consumes one email-finder credit per lookup.',
                requestBody: { required: true, content: { 'application/json': { example: { firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical Engines', jobTitle: 'Founder' } } } },
                responses: { ...okJson({ found: true, email: 'ada@analytical.com', verified: true, confidence: 'high' }), ...errResponses },
            },
        },
        '/webhooks/events': {
            get: { tags: ['Webhooks'], summary: 'List subscribable events', responses: { ...okJson({ events: ['lead.added', 'lead.connected', 'lead.messaged', 'lead.replied', 'lead.bounced', 'lead.completed'] }), ...errResponses } },
        },
        '/webhooks': {
            get: { tags: ['Webhooks'], summary: 'List your webhooks', responses: { ...okJson({ data: [{ id: 'whk_1', url: 'https://n8n…/webhook/abc', events: ['lead.replied'], active: true, failureCount: 0, lastDeliveryAt: '2026-09-02T09:00:00Z' }], total: 1 }), ...errResponses } },
            post: {
                tags: ['Webhooks'], summary: 'Register a webhook',
                description: 'Returns the signing `secret` **once** — store it to verify `X-Qampi-Signature`. Omit `events` to subscribe to all.',
                requestBody: { required: true, content: { 'application/json': { example: { url: 'https://n8n.example.com/webhook/abc', events: ['lead.replied', 'lead.connected'] } } } },
                responses: { '201': { description: 'Created', content: { 'application/json': { example: { webhook: { id: 'whk_1', url: 'https://n8n…/webhook/abc', events: ['lead.replied'], active: true, secret: 'whsec_…' } } } } }, ...errResponses },
            },
        },
        '/webhooks/{id}': {
            delete: { tags: ['Webhooks'], summary: 'Delete a webhook', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...okJson({ ok: true }), ...errResponses } },
        },
        '/webhooks/{id}/test': {
            post: { tags: ['Webhooks'], summary: 'Send a test ping', description: 'Delivers a sample `ping` event to the URL so you can verify your setup.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...okJson({ ok: true }), ...errResponses } },
        },
    },
    // OpenAPI 3.1 outbound webhooks — documents what Qampi POSTs to your URL.
    webhooks: {
        leadEvent: {
            post: {
                summary: 'Lifecycle event delivery',
                description: 'Qampi POSTs this to your registered URL when a subscribed event fires. Verify authenticity with `X-Qampi-Signature: sha256=` + HMAC-SHA256 of the raw body using your webhook `secret`.',
                requestBody: {
                    content: {
                        'application/json': {
                            example: {
                                id: 'evt_ab12',
                                event: 'lead.replied',
                                occurredAt: '2026-09-02T09:00:00Z',
                                data: { leadId: 'led_1', campaignId: 'cmp_1', lead: { id: 'led_1', firstName: 'Ada', company: 'Analytical', linkedinUrl: 'https://linkedin.com/in/ada', email: 'ada@analytical.com' }, replyContent: 'Sure, let\'s talk!' },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'Acknowledge with any 2xx.' } },
            },
        },
    },
};
