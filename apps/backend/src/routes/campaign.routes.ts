import { Router } from 'express';
import {
    createCampaign,
    getCampaigns,
    getCampaignById,
    updateCampaign,
    startCampaign,
    pauseCampaign,
    deleteCampaign,
    getCampaignStatus,
} from '../controllers/campaign.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
// New endpoint to fetch detailed campaign status
router.get('/:id/status', getCampaignStatus);

export default router;
