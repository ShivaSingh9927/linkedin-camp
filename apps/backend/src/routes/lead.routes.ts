import { Router } from 'express';
import { importLeads, getLeads, generateDemoLeads, uploadCsvLeads, deleteLead } from '../controllers/lead.controller';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.use(authMiddleware);

router.post('/import', importLeads);
router.post('/upload', upload.single('file'), uploadCsvLeads);
router.post('/demo', generateDemoLeads);
router.get('/', getLeads);
router.delete('/:id', deleteLead);

export default router;
