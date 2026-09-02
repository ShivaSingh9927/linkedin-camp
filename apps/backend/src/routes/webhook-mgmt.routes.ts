import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    listWebhookEvents, createWebhook, listWebhooks, deleteWebhook, testWebhook,
} from '../public-api/handlers';

// Session-authed webhook management for the dashboard Settings UI. Reuses the
// same handlers as the public API (they read req.user, set here by the JWT
// middleware) so both surfaces operate on the same WebhookSubscription table.
// Mounted at /api/v1/webhooks (distinct from /api/webhooks — inbound provider
// webhooks — and from /api/public/v1/webhooks — the API-key-authed version).
const router = Router();
router.use(authMiddleware);

router.get('/events', listWebhookEvents);
router.get('/', listWebhooks);
router.post('/', createWebhook);
router.delete('/:id', deleteWebhook);
router.post('/:id/test', testWebhook);

export default router;
