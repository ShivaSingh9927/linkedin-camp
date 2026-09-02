import { Response, NextFunction } from 'express';
import { prisma } from '@repo/db';
import { tierAllows } from '../config/plans';
import { tierQuotasEnforced } from '../campaign-engine/safety/quota';
import { apiError } from './util';

// Runs after apiKeyAuth on every public-API route. Enforces, in order:
//   1. onboarding complete  → 403 ONBOARDING_INCOMPLETE
//   2. tier includes `api`  → 403 UPGRADE_REQUIRED   (only when quotas enforced)
// A single user fetch covers both. /me and /usage mount BEFORE this gate so an
// automation can always diagnose why it's blocked.
export async function publicApiGate(req: any, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    if (!userId) return apiError(res, 401, 'UNAUTHORIZED', 'Invalid API key');

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { registrationStep: true, tier: true },
    }).catch(() => null);
    if (!user) return apiError(res, 401, 'UNAUTHORIZED', 'Invalid API key');

    if (user.registrationStep !== 'COMPLETED') {
        return apiError(res, 403, 'ONBOARDING_INCOMPLETE',
            'Please complete your onboarding in Qampi before using the API.');
    }

    if (tierQuotasEnforced() && !tierAllows(user.tier, 'api')) {
        return apiError(res, 403, 'UPGRADE_REQUIRED',
            'API access is available on the Pro and Business plans.',
            { feature: 'api', requiredTier: 'PRO' });
    }

    next();
}
