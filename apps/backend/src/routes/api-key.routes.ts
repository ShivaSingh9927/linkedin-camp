import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { createApiKey, listApiKeys, revokeApiKey } from '../controllers/api-key.controller';

// Key MANAGEMENT is authed by the logged-in session (JWT) — you manage keys from
// the dashboard, not with a key. The keys themselves authenticate the public API
// (see apiKeyAuth middleware), which is a separate surface.
const router = Router();
router.use(authMiddleware);

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:id', revokeApiKey);

export default router;
