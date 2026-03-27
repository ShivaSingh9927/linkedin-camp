import { Router } from 'express';
import {
    importLeads,
    getLeads,
    deleteLead,
    generateDemoLeads,
    createManualLead,
    uploadCsvLeads,
    updateLeadTags,
    bulkUpdateLeadsTags,
    getCompanies,
    enrichLead
} from '../controllers/lead.controller';
import { authMiddleware } from '../middleware/auth.middleware';
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
router.patch('/:id/tags', updateLeadTags);
router.post('/bulk-tags', bulkUpdateLeadsTags);
router.get('/companies', getCompanies);
router.post('/:id/enrich', enrichLead);

export default router;
