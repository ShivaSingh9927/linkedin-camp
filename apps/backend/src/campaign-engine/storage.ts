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
 */
export async function updateLeadEnrichment(
    leadId: string,
    output: Record<string, any>
): Promise<void> {
    const updateData: any = {};

    if (output.name) updateData.firstName = output.name;
    if (output.company) updateData.company = output.company;
    if (output.jobTitle) updateData.jobTitle = output.jobTitle;
    if (output.about) updateData.aboutInfo = output.about;
    if (output.email) updateData.email = output.email;

    if (Object.keys(updateData).length > 0) {
        await prisma.lead.update({
            where: { id: leadId },
            data: updateData
        });
    }
}

/**
 * Updates CampaignLead status after node execution.
 */
export async function updateCampaignLeadProgress(
    campaignId: string,
    leadId: string,
    data: {
        currentStepId?: string | null;
        nextActionDate?: Date;
        isCompleted?: boolean;
        status?: 'IMPORTED' | 'PENDING' | 'CONNECTED' | 'REPLIED' | 'BOUNCED';
    }
): Promise<void> {
    await prisma.campaignLead.update({
        where: { campaignId_leadId: { campaignId, leadId } },
        data: {
            ...data,
            lastActionAt: new Date()
        }
    });
}

/**
 * Updates the Lead status.
 */
export async function updateLeadStatus(
    leadId: string,
    status: 'IMPORTED' | 'PENDING' | 'CONNECTED' | 'REPLIED' | 'BOUNCED'
): Promise<void> {
    await prisma.lead.update({
        where: { id: leadId },
        data: { status }
    });
}
