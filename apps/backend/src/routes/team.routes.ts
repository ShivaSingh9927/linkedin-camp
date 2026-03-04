import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    getMyTeam,
    createTeam,
    getInviteInfo,
    inviteMember,
    joinTeam,
    removeMember
} from '../controllers/team.controller';

const router = express.Router();

// Apply auth to all team routes
router.use(authMiddleware);

// Team management
router.get('/', getMyTeam);
router.post('/create', createTeam);
router.get('/invite/:token', getInviteInfo);
router.post('/invite', inviteMember);
router.post('/join', joinTeam);
router.delete('/:teamId/members/:targetUserId', removeMember); // Use targetUserId as param

export default router;
