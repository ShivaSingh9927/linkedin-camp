import type { Page } from 'patchright';
import { prisma } from '@repo/db';
import { transitionLead } from './lifecycle';

// Central LinkedIn checkpoint/challenge handling. The engine calls
// `classifyPage` after every navigation; if it returns a checkpoint kind,
// `handleCheckpoint` records the account-level health change, defers the
// current lead through the lifecycle helper, and emits a Notification the
// UI surfaces as a banner.
//
// This is the only place that classifies LinkedIn auth/challenge surfaces —
// engine.ts, session-validator, and login-with-otp all delegate here so the
// rules stay in one place.

export type CheckpointKind =
    | 'feed'              // /feed — healthy
    | 'otp'               // /checkpoint/challenge with email-pin input
    | 'challenge_other'   // /checkpoint/* — captcha / phone / app prompt
    | 'still_login'       // bounced back to /login (creds rejected or session lost)
    | 'authwall'          // public /authwall — definitely logged out
    | 'unknown';

export interface CheckpointInfo {
    kind: CheckpointKind;
    url: string;
}

/**
 * Classify the page's current state. Cheap — one URL read + (for /checkpoint
 * URLs) a single $('input[name="pin"]') probe. Safe to call after every
 * navigation in the engine without measurable cost.
 *
 * Does NOT call waitForLoadState — callers should have already let the page
 * settle. We don't want to add a 12s networkidle wait to every navigation.
 */
export async function classifyPage(page: Page): Promise<CheckpointInfo> {
    const url = page.url();

    if (url.includes('/feed')) return { kind: 'feed', url };
    if (url.includes('/authwall')) return { kind: 'authwall', url };

    if (url.includes('/checkpoint/')) {
        // The email-pin input is the only auto-resolvable challenge variant.
        // Anything else (phone, captcha, app-prompt) lands in challenge_other
        // and needs manual user intervention.
        const pinInput = await page.$('#input__email_verification_pin, input[name="pin"]').catch(() => null);
        return { kind: pinInput ? 'otp' : 'challenge_other', url };
    }

    if (url.includes('/login') || url.includes('/uas/login')) {
        return { kind: 'still_login', url };
    }

    return { kind: 'unknown', url };
}

const CHECKPOINT_TO_HEALTH = {
    otp:             'OTP_REQUIRED',
    challenge_other: 'RESTRICTED',
    still_login:     'NEEDS_LOGIN',
    authwall:        'SESSION_EXPIRED',
} as const;

export function isCheckpoint(info: CheckpointInfo): boolean {
    return info.kind !== 'feed' && info.kind !== 'unknown';
}

export interface HandleCheckpointArgs {
    userId: string;
    campaignId?: string;
    leadId?: string;
    info: CheckpointInfo;
    /** Optional screenshot path for debugging — saved before this is called. */
    screenshotPath?: string;
}

/**
 * Mark the account unhealthy in the DB, defer the current lead (if any), and
 * insert a Notification so the UI surfaces a banner. Idempotent — repeated
 * calls in the same health-state are coalesced (we don't spam Notifications).
 *
 * Does NOT pause sibling DEFERRED leads explicitly — they're already deferred
 * by previous transitions. The cron will skip them because the next pre-flight
 * checks `accountHealth !== 'HEALTHY'` before launching.
 */
export async function handleCheckpoint(args: HandleCheckpointArgs): Promise<void> {
    const { userId, campaignId, leadId, info, screenshotPath } = args;

    const health = CHECKPOINT_TO_HEALTH[info.kind as keyof typeof CHECKPOINT_TO_HEALTH];
    if (!health) {
        console.warn(`[checkpoint] non-actionable info kind=${info.kind} — skipping handleCheckpoint`);
        return;
    }

    const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountHealth: true },
    });

    const transitioning = current?.accountHealth !== health;

    await prisma.user.update({
        where: { id: userId },
        data: {
            accountHealth: health,
            accountHealthReason: info.url.slice(0, 500),
            accountHealthAt: new Date(),
            sessionInvalid: true, // legacy mirror — keep existing callsites working
        },
    });

    if (campaignId && leadId) {
        await transitionLead(campaignId, leadId, 'DEFERRED', {
            reason: `account_${health.toLowerCase()}`,
            // No nextRetryAt — cron won't pick this up until accountHealth flips
            // back to HEALTHY (the engine's pre-flight gate enforces that).
            // Use a far-future date as a placeholder so the row still satisfies
            // the DEFERRED-needs-nextRetryAt convention.
            nextRetryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }).catch(err => console.error(`[checkpoint] transitionLead failed: ${err.message}`));
    }

    if (transitioning) {
        const titleByKind: Record<string, string> = {
            OTP_REQUIRED:    'LinkedIn needs verification',
            RESTRICTED:      'LinkedIn challenge detected',
            NEEDS_LOGIN:     'Your LinkedIn session expired',
            SESSION_EXPIRED: 'Your LinkedIn session expired',
        };
        const bodyByKind: Record<string, string> = {
            OTP_REQUIRED:    'LinkedIn sent a verification code to your email. Re-verify to resume campaigns.',
            RESTRICTED:      'LinkedIn is asking for additional verification we can\'t do automatically. Please re-log in.',
            NEEDS_LOGIN:     'Please log in again to resume campaigns.',
            SESSION_EXPIRED: 'Please log in again to resume campaigns.',
        };

        await prisma.notification.create({
            data: {
                userId,
                type: 'ACCOUNT_HEALTH',
                title: titleByKind[health] || 'LinkedIn account needs attention',
                body: bodyByKind[health] || 'Re-verify your LinkedIn account to resume campaigns.',
                meta: {
                    health,
                    detectedAt: new Date().toISOString(),
                    url: info.url,
                    screenshotPath,
                    campaignId,
                    leadId,
                },
            },
        }).catch(err => console.error(`[checkpoint] notification insert failed: ${err.message}`));
    }

    console.log(`[checkpoint] user=${userId} health=${health} url=${info.url}`);
}

/**
 * Auto-pause a campaign because LinkedIn served a challenge / killed the
 * session mid-run. Tagged with pausedReason='session_expired' so
 * markAccountHealthy() can auto-resume exactly the campaigns WE paused and
 * leave campaigns the user paused by hand untouched. Idempotent.
 */
export async function pauseCampaignForSessionExpiry(campaignId: string): Promise<void> {
    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED', pausedReason: 'session_expired' },
    }).catch(err => console.error(`[checkpoint] pauseCampaignForSessionExpiry failed: ${err.message}`));
}

/**
 * Called by loginWithOtp after a successful refresh. Flips the user back to
 * HEALTHY so the engine's pre-flight gate lets new runs through; the cron
 * picks up the DEFERRED leads on its next tick.
 */
export async function markAccountHealthy(userId: string): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: {
            accountHealth: 'HEALTHY',
            accountHealthReason: null,
            accountHealthAt: new Date(),
            sessionInvalid: false,
            sessionValidatedAt: new Date(),
        },
    });

    // De-defer: when an account flips back to HEALTHY, un-park every lead
    // that handleCheckpoint pushed 365 days into the future. Without this,
    // recovered users would wait a year for the cron to retry. The
    // statusReason `account_*` filter keeps us from accidentally re-running
    // leads deferred for unrelated reasons (cap, off-hours, delay-node).
    const unparked = await prisma.$executeRaw`
        UPDATE "CampaignLeadProgress" p
        SET    "nextRetryAt" = NOW()
        FROM   "Campaign" c
        WHERE  p."campaignId" = c.id
          AND  c."userId" = ${userId}
          AND  p."status" = 'DEFERRED'
          AND  p."statusReason" LIKE 'account_%'
    `;
    console.log(`[checkpoint] user=${userId} → HEALTHY (un-parked ${unparked} leads)`);

    // Auto-resume the campaign(s) WE auto-paused for this session expiry. We
    // only touch campaigns tagged pausedReason='session_expired' — a campaign
    // the user paused by hand stays paused. The 1-active-per-user invariant
    // means there's normally just one, but we handle all defensively. The cron
    // heartbeat (ACTIVE campaigns) + the un-parked leads above then resume
    // execution on the next tick; no re-enrollment needed.
    const toResume = await prisma.campaign.findMany({
        where: { userId, status: 'PAUSED', pausedReason: 'session_expired' },
        select: { id: true, name: true },
    });
    if (toResume.length > 0) {
        await prisma.campaign.updateMany({
            where: { userId, status: 'PAUSED', pausedReason: 'session_expired' },
            data: { status: 'ACTIVE', pausedReason: null },
        }).catch(err => console.error(`[checkpoint] auto-resume failed: ${err.message}`));

        await prisma.notification.create({
            data: {
                userId,
                type: 'ACCOUNT_HEALTH',
                title: 'Campaign resumed',
                body: toResume.length === 1
                    ? `Re-login succeeded — "${toResume[0].name}" has resumed.`
                    : `Re-login succeeded — ${toResume.length} campaigns resumed.`,
                meta: { resumedCampaignIds: toResume.map(c => c.id) },
            },
        }).catch(err => console.error(`[checkpoint] resume notification failed: ${err.message}`));

        try {
            const { io } = await import('../../socket');
            io.to(`user_${userId}`).emit('CAMPAIGN_RESUMED', {
                userId,
                campaignIds: toResume.map(c => c.id),
                timestamp: new Date().toISOString(),
            });
        } catch (err: any) {
            console.error(`[checkpoint] resume socket emit failed: ${err?.message}`);
        }

        console.log(`[checkpoint] user=${userId} auto-resumed ${toResume.length} campaign(s)`);
    }
}
