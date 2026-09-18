/**
 * Campaign lifecycle notifications.
 *
 * Kept out of the engine on purpose: the engine's job is to run LinkedIn
 * actions safely, and an SMTP hiccup must never affect whether a campaign
 * completes. Every function here is fire-and-forget and swallows its own
 * errors — the EmailLog row records what happened either way.
 *
 * There is deliberately NO "campaign started" email. The user launched it
 * themselves seconds earlier; mail that reports what someone just did is how a
 * product teaches people to ignore its mail, and then the one that matters —
 * "your campaign has stopped" — goes unread too.
 */

import { prisma } from '@repo/db';
import { mailService } from './mail.service';

/** Owner's email + first name, or null when the campaign/user is gone. */
async function ownerOf(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, name: true, userId: true },
    }).catch(() => null);
    if (!campaign) return null;

    const user = await prisma.user.findUnique({
        where: { id: campaign.userId },
        select: { id: true, email: true, firstName: true },
    }).catch(() => null);
    if (!user?.email) return null;

    return { campaign, user };
}

/**
 * Campaign finished — sent with what it actually produced.
 *
 * Counts come from CampaignLeadProgress, the single source of connection
 * truth, and replies from inbound Messages rather than the run state: a lead
 * who replies after their sequence ended is still a reply, and the run-state
 * machine has no way to represent that.
 */
export async function notifyCampaignFinished(campaignId: string): Promise<void> {
    try {
        const ctx = await ownerOf(campaignId);
        if (!ctx) return;

        const leadIds = await prisma.campaignLeadProgress.findMany({
            where: { campaignId }, select: { leadId: true, connectionStatus: true },
        }).catch(() => [] as Array<{ leadId: string; connectionStatus: string }>);

        const replied = leadIds.length
            ? await prisma.message.findMany({
                where: { leadId: { in: leadIds.map(l => l.leadId) }, direction: 'RECEIVED' },
                select: { leadId: true },
                distinct: ['leadId'],
            }).catch(() => [])
            : [];

        await mailService.sendCampaignFinishedEmail({
            userId: ctx.user.id,
            to: ctx.user.email,
            name: ctx.user.firstName || '',
            campaignId,
            campaignName: ctx.campaign.name,
            stats: {
                leads: leadIds.length,
                connected: leadIds.filter(l => l.connectionStatus === 'connected').length,
                replied: replied.length,
            },
        });
    } catch (err: any) {
        console.error(`[CAMPAIGN-MAIL] finished notification failed (${campaignId}): ${err?.message}`);
    }
}

/**
 * Campaign paused and needs a human.
 *
 * The one email in this file that genuinely earns its place: without it, a
 * campaign killed by an expired LinkedIn session sits dead until the user
 * happens to log in, and every day of that is outreach they think is running.
 */
export async function notifyCampaignNeedsAttention(campaignId: string, reason: string): Promise<void> {
    try {
        const ctx = await ownerOf(campaignId);
        if (!ctx) return;

        await mailService.sendCampaignAttentionEmail({
            userId: ctx.user.id,
            to: ctx.user.email,
            name: ctx.user.firstName || '',
            campaignId,
            campaignName: ctx.campaign.name,
            reason,
        });
    } catch (err: any) {
        console.error(`[CAMPAIGN-MAIL] attention notification failed (${campaignId}): ${err?.message}`);
    }
}
