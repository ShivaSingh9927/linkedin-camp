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
    getCampaignOverview,
    getCampaignFunnel,
    getCampaignLeads,
    bulkSyncLeadsToCRM,
    bulkMoveLeadsToCampaign,
    getCampaignMessages,
    getCampaignPerformance,
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
router.get('/:id/overview', getCampaignOverview);
router.get('/:id/funnel', getCampaignFunnel);
router.get('/:id/leads', getCampaignLeads);
router.post('/:id/leads/bulk/crm-sync', bulkSyncLeadsToCRM);
router.post('/:id/leads/bulk/move', bulkMoveLeadsToCampaign);
router.get('/:id/messages', getCampaignMessages);
router.get('/:id/performance', getCampaignPerformance);
router.get('/:id/status', getCampaignStatus);
router.delete('/:id/leads/:leadId', removeLeadFromCampaign);
router.get('/:id/export', exportCampaign);

export default router;
