import { Router } from 'express';
import { openApiSpec } from '../public-api/openapi';

// PUBLIC (no auth) — a spec describes the API, it holds no secrets. Mounted
// BEFORE the API-key-protected public router so these paths aren't gated.
const router = Router();

router.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
});

// Keep the legacy API-domain URL working, but serve the first-party docs UI.
// The OpenAPI JSON above remains available for tooling and generated clients.
router.get('/docs', (_req, res) => {
    const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.qampi.com').replace(/\/$/, '');
    res.redirect(302, `${appUrl}/api-reference`);
});

export default router;
