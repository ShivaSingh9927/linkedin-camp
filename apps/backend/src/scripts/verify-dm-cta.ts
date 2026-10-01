// Does a DM to an existing connection still ask them to connect?
//
// Reads the REAL stored state for real leads, resolves connectedness the way
// SEND_MESSAGE now does, and asks the AI service for the message it would
// write. Nothing is sent and no browser is opened — the only outbound call is
// to our own ai-service.
//
// ENV: QLEAD_IDS (comma-separated), QCAMPAIGN_ID

import { prisma } from '@repo/db';
import axios from 'axios';
import { resolveConnection } from '../campaign-engine/connection-resolve';

const AI = process.env.AI_SERVICE_URL || 'http://10.0.0.4:8001';
const ASKS_TO_CONNECT = /connect with you|love to connect|great to connect|open to connecting|like to connect|happy to connect/i;

async function main() {
    const leadIds = (process.env.QLEAD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const campaignId = process.env.QCAMPAIGN_ID || '';
    if (!leadIds.length || !campaignId) { console.error('QLEAD_IDS and QCAMPAIGN_ID required'); process.exit(2); }

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const bp = await prisma.businessProfile.findUnique({ where: { userId: campaign!.userId } });

    let failures = 0;
    for (const leadId of leadIds) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        const cl = await prisma.campaignLead.findUnique({
            where: { campaignId_leadId: { campaignId, leadId } },
            select: { personalization: true },
        });
        const progress = await prisma.campaignLeadProgress.findUnique({
            where: { campaignId_leadId: { campaignId, leadId } },
            select: { connectionStatus: true },
        });
        const storedOutputs = ((cl?.personalization as any)?.nodeOutputs || {}) as Record<string, Record<string, any>>;

        const resolved = resolveConnection(
            (progress?.connectionStatus as any) ?? undefined,
            storedOutputs,
            (lead?.status as string | undefined) ?? null,
            lead?.connectionDegree ?? null,
        );
        const alreadyConnected = resolved.connected === true;

        console.log(`\n=== ${lead?.firstName} ${lead?.lastName || ''}`);
        console.log(`    progress.connectionStatus = ${progress?.connectionStatus ?? 'null'}`);
        console.log(`    Lead.connectionDegree     = ${lead?.connectionDegree ?? 'null'}`);
        console.log(`    profileVisit.connected    = ${storedOutputs['profile-visit']?.connected ?? 'absent'}`);
        console.log(`    → resolved: connected=${resolved.connected} source=${resolved.from}  ⇒ already_connected=${alreadyConnected}`);

        const { data } = await axios.post(`${AI}/ai/message`, {
            recipient_name: `${lead?.firstName} ${lead?.lastName || ''}`.trim(),
            recipient_headline: lead?.headline,
            company: lead?.company,
            location: lead?.location,
            campaign_description: campaign?.description,
            connection_context: campaign?.objective,
            tone: campaign?.toneOverride || 'friendly',
            cta: campaign?.cta || 'connect',
            already_connected: alreadyConnected,
            persona: bp?.persona,
            value_proposition: bp?.valueProp,
            ai_strategy: bp?.aiStrategy,
            user_context: {
                goalType: bp?.goalType,
                selfHeadline: bp?.selfHeadline,
                selfProfileSummary: bp?.selfProfileSummary,
                persona: bp?.persona,
                companyDescription: bp?.companyDescription,
                products: bp?.products,
                communicationStyle: bp?.communicationStyle,
                industry: bp?.industry,
                targetAudience: bp?.targetAudience,
            },
            channel: 'linkedin',
        }, { timeout: 90000 });

        const msg: string = data.message || '';
        console.log(`\n${msg}\n`);
        const asks = ASKS_TO_CONNECT.test(msg);
        if (alreadyConnected && asks) {
            console.log('    ❌ FAIL — already connected, but the message asks to connect');
            failures++;
        } else if (alreadyConnected) {
            console.log('    ✅ PASS — already connected, no connect request');
        } else {
            console.log(`    (not connected — a connect request is legitimate here; present=${asks})`);
        }
    }

    await prisma.$disconnect();
    console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed. Nothing was sent.');
    process.exit(failures ? 1 : 0);
}

main().catch(async (e) => { console.error(e?.message || e); await prisma.$disconnect(); process.exit(1); });
