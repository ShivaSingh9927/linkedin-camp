import { prisma } from "@repo/db";
import { SubscriptionTier } from "@prisma/client";

/**
 * Automatically downgrades users whose 7-day CORE trial has expired.
 * Should be run by a daily cron job or periodic worker.
 */
export async function downgradeExpiredTrials(): Promise<void> {
    const defaultTrialDays = 7;
    const now = new Date();

    // Find users who are on CORE plan, have a trialEndsAt that is in the past, and have not been downgraded
    const usersToDowngrade = await prisma.user.findMany({
        where: {
            tier: 'CORE',
            trialEndsAt: {
                lt: now
            }
        },
        select: {
            id: true,
            email: true
        }
    });

    if (usersToDowngrade.length === 0) {
        console.log("[Trial Manager] No expired trials to downgrade at this time.");
        return;
    }

    // Downgrade them to FREE
    for (const user of usersToDowngrade) {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                tier: 'FREE'
            }
        });

        // Optionally dispatch a notification
        await prisma.notification.create({
            data: {
                userId: user.id,
                type: "INFO",
                title: "Trial Expired",
                body: "Your 7-day CORE trial has expired. You have been downgraded to the Free plan. To unlock premium features, please upgrade your subscription.",
            }
        });

        console.log(`[Trial Manager] Downgraded user ${user.email} from CORE to FREE as trial expired.`);
    }

    console.log(`[Trial Manager] Successfully downgraded ${usersToDowngrade.length} users.`);
}
