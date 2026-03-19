import { Router } from 'express';
import {
    importLeads,
    getLeads,
    deleteLead,
    generateDemoLeads,
    createManualLead,
    uploadCsvLeads
} from '../controllers/lead.controller';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.use(authMiddleware);

router.post('/import', importLeads);
router.post('/upload', upload.single('file'), uploadCsvLeads);
router.get('/', getLeads);
router.delete('/:id', deleteLead);
router.post('/demo', generateDemoLeads);
router.post('/manual', createManualLead);

export default router;
