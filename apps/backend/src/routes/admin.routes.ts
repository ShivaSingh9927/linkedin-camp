import { Router } from 'express';
import { addProxies, listProxies, deleteProxy } from '../controllers/admin.controller';

const router = Router();

// TODO: Add strict admin authentication middleware here!
// Currently open for easy testing on your end, but MUST be protected before production launch.
// e.g. router.use(verifyAdminToken);

router.post('/proxies', addProxies);
router.get('/proxies', listProxies);
router.delete('/proxies/:id', deleteProxy);

export default router;
