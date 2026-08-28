import { prisma } from '@repo/db';
import { NodeExecution } from './types';

/**
 * Reads stored node outputs for a CampaignLead from personalization JSON field.
 */
export async function readNodeOutputs(campaignId: string, leadId: string): Promise<Record<string, Record<string, any>>> {
    const campaignLead = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId, leadId } },
        select: { personalization: true }
    });

    const data = campaignLead?.personalization as any;
    if (!data?.nodeOutputs) return {};
    return data.nodeOutputs;
}

/**
 * Appends a node execution result to the CampaignLead personalization field.
 */
export async function writeNodeOutput(
    campaignId: string,
    leadId: string,
    execution: NodeExecution
): Promise<void> {
    const campaignLead = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId, leadId } },
        select: { personalization: true }
    });

    const existing = (campaignLead?.personalization as any) || {};
    if (!existing.nodeOutputs) existing.nodeOutputs = {};
    if (!existing.execLog) existing.execLog = [];

    if (execution.output) {
        existing.nodeOutputs[execution.node] = execution.output;
    }
    existing.execLog.push(execution);

    await prisma.campaignLead.update({
        where: { campaignId_leadId: { campaignId, leadId } },
        data: { personalization: existing }
    });
}

/**
 * Updates the Lead model with enriched data from profile-visit.
 *
 * Canonical post-scrape writer — profile-visit no longer writes the lead row
 * itself. Splits output.name into firstName/lastName so the firstName column
 * doesn't get corrupted with the full name. Persists every field the send-
 * message fallback reads so a future run on the same lead doesn't have to
 * re-scrape just to get personalization.
 */
export async function updateLeadEnrichment(
    leadId: string,
    output: Record<string, any>
): Promise<void> {
    const updateData: any = {};

    if (output.name) {
        const parts = String(output.name).split(/\s+/).filter(Boolean);
        if (parts[0]) updateData.firstName = parts[0];
        if (parts.length > 1) updateData.lastName = parts.slice(1).join(' ');
    }
    if (output.headline) updateData.headline = output.headline;
    if (output.location) updateData.location = output.location;
    if (output.company) updateData.company = output.company;
    if (output.jobTitle) updateData.jobTitle = output.jobTitle;
    if (output.about) updateData.aboutInfo = output.about;
    if (output.email) updateData.email = output.email;
    if (output.phone) updateData.phone = output.phone;
    if (Array.isArray(output.experience) && output.experience.length > 0) updateData.experience = output.experience;
    if (Array.isArray(output.education) && output.education.length > 0) updateData.education = output.education;
    if (output.latestPost) updateData.latestPost = output.latestPost;
    if (output.latestPostUrl) updateData.latestPostUrl = output.latestPostUrl;

    if (Object.keys(updateData).length > 0) {
        // Stamp enrichment freshness whenever a profile-visit wrote anything.
        updateData.enrichedAt = new Date();
        await prisma.lead.update({
            where: { id: leadId },
            data: updateData
        });
    }
}

/**
 * Persist a post that a comment/like node discovered onto the Lead row.
 *
 * Those nodes navigate the lead's activity feed and read the post URN + text as
 * a side effect of doing their real job. Because they do, profile-visit is told
 * to skip its own duplicate scrape (see postsCoveredLater) — so this is what
 * keeps Lead.latestPost populated for the UI. Without it, dropping the redundant
 * scrape would silently empty the "Recent post" panel.
 *
 * Prefers the login-free public post page for the text: JSON-LD gives the full,
 * clean articleBody, whereas DOM innerText is truncated and carries reaction/UI
 * chrome. That fetch uses no session, no cookies and no proxy, so it costs the
 * LinkedIn account nothing. Falls back to the scraped text.
 *
 * Best-effort throughout — a write node must never fail because a display field
 * couldn't be cached.
 */
export async function persistDiscoveredPost(
    leadId: string,
    postUrl: string | null,
    postContent: string | null,
): Promise<void> {
    if (!leadId || !postUrl) return;
    try {
        let text = postContent || null;
        const urn = postUrl.match(/urn:li:(?:activity|ugcPost|share):\d+/)?.[0] || null;
        if (urn) {
            const { fetchPublicPostContent } = await import('../services/public-post.service');
            const pub = await fetchPublicPostContent(urn).catch(() => null);
            if (pub?.text) text = pub.text;
        }
        if (!text) return;
        await prisma.lead.update({
            where: { id: leadId },
            data: { latestPost: text, latestPostUrl: postUrl },
        });
    } catch (err: any) {
        console.log(`[STORAGE] persistDiscoveredPost failed for ${leadId}: ${err?.message}`);
    }
}

// (removed dead writers updateCampaignLeadProgress / updateLeadStatus — the coarse
// Lead/CampaignLead status is now written ONLY by syncLeadStatus in safety/lifecycle.ts)
