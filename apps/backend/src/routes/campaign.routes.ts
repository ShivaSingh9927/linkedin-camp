import { Router } from 'express';
import {
    createCampaign,
    getCampaigns,
    getCampaignById,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    getCampaignStatus,
    removeLeadFromCampaign,
    exportCampaign,
    queueCampaign,
    unqueueCampaign,
    reorderQueueHandler,
    getCampaignEta,
} from '../controllers/campaign.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/queue', queueCampaign);
router.post('/:id/unqueue', unqueueCampaign);
router.post('/queue/reorder', reorderQueueHandler);
router.get('/:id/eta', getCampaignEta);
router.get('/:id/status', getCampaignStatus);
router.delete('/:id/leads/:leadId', removeLeadFromCampaign);
router.get('/:id/export', exportCampaign);

export default router;
