import { Router } from 'express';
import { openApiSpec } from '../public-api/openapi';

// PUBLIC (no auth) — a spec describes the API, it holds no secrets. Mounted
// BEFORE the API-key-protected public router so these paths aren't gated.
const router = Router();

router.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
});

// Human docs via Redoc (loaded from CDN — this is a normal server-rendered page,
// not a CSP-restricted artifact). Points at the spec above.
router.get('/docs', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Qampi API</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>💜</text></svg>"/>
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="./openapi.json" theme='{"colors":{"primary":{"main":"#7c3aed"}}}'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
});

export default router;
