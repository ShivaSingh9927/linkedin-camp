import { prisma } from "@repo/db";
import { LinkedinPlan, SubscriptionTier } from "@prisma/client";
import { getSafeDailyLimit } from "../utils/limitCalculator";

/**
 * Checks if a user's LinkedIn Plan is holding back their SaaS plan limits.
 * If true, automatically generates a warning notification the user can see in their dashboard.
 */
export async function enforceAndNotifyLimits(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            tier: true,
            linkedinPlan: true,
            email: true
        }
    });

    if (!user) return;

    // Use our Limit Calculator
    const limits = getSafeDailyLimit(user.tier, user.linkedinPlan);

    // If limits.isThrottledByLinkedIn is TRUE, it means their SaaS Plan gives them
    // more quota, but we had to throttle them down to protect their inferior LinkedIn Plan.
    if (limits.isThrottledByLinkedIn) {
        // Prevent duplicate warnings by checking if an unread warning of this type already exists
        const existingWarning = await prisma.notification.findFirst({
            where: {
                userId,
                type: "THROTTLED_WARNING",
                read: false
            }
        });

        if (!existingWarning) {
            const message = `Active Limiter Engaged: You possess a ${user.tier} subscription, but your LinkedIn account is ${user.linkedinPlan}. We have intelligently slowed your campaigns down to a limit of ${limits.safeDailyLimit} invites/day to protect your account. Upgrade to LinkedIn Premium/Sales Nav to unlock your full speed.`;

            await prisma.notification.create({
                data: {
                    userId,
                    type: "THROTTLED_WARNING",
                    title: "Action Limits Throttled For Account Safety",
                    body: message,
                }
            });
            console.log(`[Limit Enforcer] Throttled limit warning dispatched to user ${user.email}`);
        }
    }
}
