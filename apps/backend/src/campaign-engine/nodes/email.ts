import { NodeHandler, NodeResult } from '../types';
import { resolveVariables } from '../variables';
import { sendEmail } from '../../services/email.service';

function normalizeBraces(text: string): string {
    return text.replace(/\{([^{}]+)\}/g, '{{$1}}');
}

/**
 * EMAIL node — sends a personalized email via the user's connected
 * email account (SMTP today, OAuth providers later).
 *
 * Config:
 *   - subject: string with {firstName}/{{firstName}} placeholders
 *   - message / body: plaintext body, same placeholder syntax
 *   - html: optional pre-rendered HTML (else service wraps text in <p>)
 *
 * Skip semantics (success, no send):
 *   - lead.email is null/empty → nothing to send to
 *   - upstream EMAIL_FINDER returned null (currently a NOOP, so always
 *     skipped — the IF_ELSE templates guard against this already)
 *
 * Failure semantics (node fails, lead progresses to next step):
 *   - no EmailAccount connected → "configure email" toast surfaces in UI
 *   - SMTP auth fails → user re-enters creds, lastError saved
 *   - transient network → retry handled by BullMQ at job layer, not here
 */
export const emailNode: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { lead, userId, campaignId, storedOutputs, campaign } = ctx;

    const recipient = (storedOutputs['email-finder']?.email as string | undefined) || lead.email;
    if (!recipient) {
        console.log('[EMAIL] No recipient address for lead — skipping send.');
        return { success: true, output: { sent: false, skipReason: 'no_recipient' } };
    }

    const rawSubject = config.subject || 'Quick question';
    const rawBody = config.message || config.body || config.text || 'Hi {firstName},';

    // Reuse the existing variable resolver — same {{firstName}}/{{company}}
    // vocabulary the LinkedIn message templates use, so the builder UI
    // stays consistent across both channels.
    const vars = {
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        company: lead.company || storedOutputs['profile-visit']?.company || '',
        jobTitle: lead.jobTitle || storedOutputs['profile-visit']?.jobTitle || '',
        cta: campaign?.cta || '',
    };
    const subject = resolveVariables(normalizeBraces(rawSubject), vars);
    const body = resolveVariables(normalizeBraces(rawBody), vars);

    console.log(`[EMAIL] Sending to ${recipient}: "${subject.substring(0, 60)}..."`);

    const result = await sendEmail({
        userId,
        leadId: lead.id,
        campaignId,
        to: recipient,
        subject,
        text: body,
        html: config.html,
    });

    if (!result.success) {
        console.error(`[EMAIL] Send failed: ${result.error}`);
        return { success: false, error: result.error, output: { sent: false, error: result.error } };
    }

    // lead.messaged CRM event mirrors the LinkedIn send-message side-effect.
    // Fire-and-forget — failure here shouldn't block the workflow.
    import('../../services/crm-events')
        .then(({ emitCrmEvent }) => emitCrmEvent({ event: 'lead.messaged', userId, campaignId, leadId: lead.id, meta: { channel: 'email' } }))
        .catch((err: any) => console.error('[EMAIL] emit lead.messaged failed:', err?.message));

    return {
        success: true,
        output: { sent: true, messageId: result.messageId, to: recipient, subject },
    };
};
