import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { apiKeyAuth } from '../middleware/api-key.middleware';
import { publicApiGate } from '../public-api/gate.middleware';
import { apiError } from '../public-api/util';
import {
    listTemplates, getTemplate,
    listLeads, createLeads, getLead, patchLead,
    listCampaigns, getCampaign, listCampaignLeads, enrollLeads, launchCampaign, createFromTemplate,
    searchPeopleHandler, enrichEmailHandler,
    getMe, getUsage,
    listWebhookEvents, createWebhook, listWebhooks, deleteWebhook, testWebhook,
} from '../public-api/handlers';

const router = Router();

// Every public-API request authenticates with an API key (not a login JWT).
router.use(apiKeyAuth);

// Per-key rate limit (keyed on the resolved user). 120 req/min.
router.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.id || req.ip,
    handler: (_req, res) => apiError(res, 429, 'RATE_LIMITED', 'Too many requests — slow down.'),
}));

// Diagnostic endpoints work even before onboarding completes, so an automation
// can always discover WHY it's blocked.
router.get('/me', getMe);
router.get('/usage', getUsage);

// Everything below requires: onboarding complete + tier includes `api`.
router.use(publicApiGate);

router.get('/templates', listTemplates);
router.get('/templates/:id', getTemplate);

router.get('/leads', listLeads);
router.post('/leads', createLeads);
router.get('/leads/:id', getLead);
router.patch('/leads/:id', patchLead);

router.get('/campaigns', listCampaigns);
router.post('/campaigns/from-template', createFromTemplate);
router.get('/campaigns/:id', getCampaign);
router.get('/campaigns/:id/leads', listCampaignLeads);
router.post('/campaigns/:id/leads', enrollLeads);
router.post('/campaigns/:id/launch', launchCampaign);

router.post('/search/people', searchPeopleHandler);
router.post('/enrich/email', enrichEmailHandler);

// Outbound webhooks (triggers) — register an n8n/Zapier/Make URL + events.
router.get('/webhooks/events', listWebhookEvents);
router.get('/webhooks', listWebhooks);
router.post('/webhooks', createWebhook);
router.delete('/webhooks/:id', deleteWebhook);
router.post('/webhooks/:id/test', testWebhook);

export default router;
