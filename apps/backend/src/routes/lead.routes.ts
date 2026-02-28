import { Router } from 'express';
import { importLeads, getLeads, generateDemoLeads } from '../controllers/lead.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/import', importLeads);
router.post('/demo', generateDemoLeads);
router.get('/', getLeads);

export default router;
