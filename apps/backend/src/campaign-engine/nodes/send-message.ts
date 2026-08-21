import { NodeHandler, NodeResult, SendMessageOutput } from '../types';
import { resolveVariables } from '../variables';
import { generateAIMessage } from '../ai-service';
import { buildRationale } from '../ai-rationale';
import { deliverDirectMessage } from './deliver-dm';

/**
 * Converts single-brace {variable} to double-brace {{variable}} for resolveVariables.
 * The campaign builder UI uses {firstName} syntax but the resolver expects {{firstName}}.
 */
function normalizeBraces(text: string): string {
    // Convert {var} to {{var}} but don't double-convert {{var}}
    return text.replace(/\{([^{}]+)\}/g, '{{$1}}');
}

export const sendMessage: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, storedOutputs, campaign, aiContext } = ctx;
    const rawText = config.message || config.text || 'Hello!';
    const aiEnabled = config.aiEnabled || false;
    const tone = config.tone || campaign?.toneOverride || 'professional';
    const cta = config.cta || campaign?.cta || 'connect';

    const output: SendMessageOutput = { messageText: '', sent: false };

    try {
        let messageText: string;
        if (aiEnabled) {
            console.log('[SEND-MESSAGE] Generating AI message...');
            try {
                const profileName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'User';

                // Prefer freshly-scraped data from a prior profile-visit step in the
                // same workflow; fall back to whatever's on the Lead row (set at
                // import / from prior runs) so AI generation isn't blank-slate
                // when the workflow has no profile-visit step.
                const pv = storedOutputs['profile-visit'] || {};
                // Recent post is a soft personalization hook. It's only present
                // when the profile-visit step ran with enrichPosts — so passing
                // it is implicitly gated by the template opting in. Absent →
                // undefined → message generation is unchanged.
                const latestPost = (pv.latestPost as string | undefined) || undefined;
                const profileData = {
                    name: profileName,
                    headline:   pv.headline   || pv.jobTitle   || lead.headline  || lead.jobTitle || null,
                    location:   pv.location   || lead.location || null,
                    company:    pv.company    || lead.company  || null,
                    jobTitle:   pv.jobTitle   || lead.jobTitle || null,
                    about:      pv.about      || lead.aboutInfo || null,
                    experience: pv.experience || [],
                    education: pv.education || [],
                };
                
                // Campaign context for personalized outreach
                const campaignContext = {
                    objective: campaign?.objective || 'Connect with prospects',
                    description: campaign?.campaignDescription || campaign?.objective || null,
                    tone: tone,
                    cta: cta,
                    persona: campaign?.persona,
                    valueProp: campaign?.valueProp,
                };
                
                const aiResult = await generateAIMessage({
                    profileName: profileData.name,
                    profileHeadline: profileData.headline || undefined,
                    company: profileData.company || undefined,
                    jobTitle: profileData.jobTitle || undefined,
                    location: profileData.location || undefined,
                    about: profileData.about || undefined,
                    experience: profileData.experience,
                    education: profileData.education,
                    postContent: latestPost,
                    connectionContext: campaignContext.objective || undefined,
                    campaignDescription: campaignContext.description || undefined,
                    // Per-step overrides (set in the builder's Step Settings) win
                    // over the campaign-level defaults.
                    tone: (config as any).tone || campaignContext.tone,
                    cta: (config as any).cta || campaignContext.cta,
                    persona: campaignContext.persona || aiContext?.userContext?.persona || undefined,
                    valueProposition: campaignContext.valueProp || aiContext?.userContext?.valueProp || undefined,
                    aiStrategy: aiContext?.aiStrategy,
                    userContext: aiContext?.userContext,
                    // Phase C
                    channel: 'linkedin',
                    aiPrompt: (config as any).aiPrompt,
                    campaignProgress: (ctx as any).campaignProgress,
                    messageHistory: (ctx as any).messageHistory,
                });
                const aiMessage = aiResult.message;
                if (aiMessage && aiMessage.length > 10) {
                    messageText = aiMessage;
                    output.aiGenerated = true;
                    output.rationale = buildRationale({
                        latestPost,
                        company: profileData.company,
                        jobTitle: profileData.jobTitle,
                        headline: profileData.headline,
                        about: profileData.about,
                        aiStrategy: aiContext?.aiStrategy,
                        campaignProgress: (ctx as any).campaignProgress,
                    });
                    console.log('[SEND-MESSAGE] AI message generated:', messageText.substring(0, 50) + '...');
                } else {
                    console.log('[SEND-MESSAGE] AI output invalid, using fallback');
                    messageText = resolveVariables(normalizeBraces(rawText), { storedOutputs, lead });
                }
            } catch (aiError: any) {
                console.error('[SEND-MESSAGE] AI generation failed, using fallback:', aiError.message);
                messageText = resolveVariables(normalizeBraces(rawText), { storedOutputs, lead });
            }
        } else {
            messageText = resolveVariables(normalizeBraces(rawText), { storedOutputs, lead });
        }
        output.messageText = messageText;

        console.log(`[SEND-MESSAGE] Delivering message via shared DM path...`);
        const deliver = await deliverDirectMessage(page, lead, messageText);
        if (deliver.skipped) {
            output.sent = false;
            output.skipped = true;
            output.skipReason = deliver.skipReason;
            return { success: true, output };
        }
        if (deliver.error) {
            return { success: false, error: deliver.error };
        }
        output.sent = deliver.sent;
        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
