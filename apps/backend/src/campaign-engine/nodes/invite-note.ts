/**
 * Connection-invite NOTE: generation + attachment.
 *
 * Templates have shipped CONNECT steps labelled "Send Invite (AI note)" since
 * the beginning, setting `aiEnabled: true` and `message` on the node — and
 * nothing read either one. The connect node clicked straight through the modal
 * via "Send without a note", so every one of those invites went out bare while
 * the builder said otherwise. This module is the missing half.
 *
 * Two things worth knowing about LinkedIn's note UI, both handled below:
 *   - The note is hard-capped (300 chars historically; some builds render 200).
 *     The textarea carries the real cap in `maxlength`, so read it rather than
 *     assuming — typing past it is silently truncated mid-word.
 *   - Note-invites are RATIONED on free accounts. When the allowance is spent
 *     LinkedIn simply doesn't offer "Add a note" (or shows an upsell instead of
 *     a textarea). That is not an error: the invite still goes, just bare. We
 *     report it honestly rather than failing the node.
 */

import { resolveVariables } from '../variables';
import { generateAIMessage } from '../ai-service';
import { NodeContext, CampaignFlowNode } from '../types';
import { profileVisitOutput } from '../profile-output';

/** Absolute ceiling. The textarea's maxlength wins when it's lower. */
export const NOTE_HARD_LIMIT = 300;

/**
 * What to assume when the textarea carries NO maxlength. Measured, not guessed:
 * on rajaji (2026-09-16) the field advertised no cap, accepted 237 characters
 * of text, and simply left "Send invitation" DISABLED — 200 was the first
 * length it would send. 300 is still allowed when a build says so explicitly.
 */
const ASSUMED_CAP_WHEN_UNDECLARED = 200;

/** Leave headroom under the cap so the AI's last sentence survives intact. */
const AI_TARGET_CHARS = 190;

const NOTE_INSTRUCTION =
    'This is a LinkedIn CONNECTION REQUEST NOTE, not a direct message. '
    + `HARD LIMIT: ${AI_TARGET_CHARS} characters including spaces — shorter is better. `
    + 'Two sentences maximum. Reference one concrete detail from their profile, say plainly why you want to connect, '
    + 'and make NO pitch, NO meeting ask, NO links, NO signature and NO line breaks.';

function normalizeBraces(text: string): string {
    return text.replace(/\{([^{}]+)\}/g, '{{$1}}');
}

/**
 * Trim to `max` chars without cutting mid-word. Prefers the last sentence
 * boundary when one lands in the final third, so a clipped note still reads
 * like a finished thought rather than a dropped call.
 */
export function clampNote(text: string, max: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;

    const head = clean.slice(0, max);
    const lastStop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
    if (lastStop > max * 0.6) return head.slice(0, lastStop + 1).trim();

    const lastSpace = head.lastIndexOf(' ');
    return (lastSpace > 0 ? head.slice(0, lastSpace) : head).trim();
}

/**
 * Resolve the note for this CONNECT step, or null when the step is configured
 * to send a bare invite (no `message`, AI off). Never throws — a failed AI call
 * falls back to the authored text, and an empty result means "send it bare",
 * which is always better than failing an invite over copy.
 */
export async function buildInviteNote(ctx: NodeContext, config: CampaignFlowNode): Promise<string | null> {
    const { lead, storedOutputs, campaign, aiContext } = ctx;
    const raw = String(config.message || config.text || '').trim();
    const aiEnabled = config.aiEnabled === true;

    if (!aiEnabled && !raw) return null;

    const authored = raw
        ? clampNote(resolveVariables(normalizeBraces(raw), { storedOutputs, lead }), NOTE_HARD_LIMIT)
        : null;

    if (!aiEnabled) return authored || null;

    try {
        const pv = profileVisitOutput(storedOutputs) as any;
        const profileName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'there';

        const aiResult = await generateAIMessage({
            profileName,
            profileHeadline: pv.headline || pv.jobTitle || lead.headline || lead.jobTitle || undefined,
            company: pv.company || lead.company || undefined,
            jobTitle: pv.jobTitle || lead.jobTitle || undefined,
            location: pv.location || lead.location || undefined,
            about: pv.about || lead.aboutInfo || undefined,
            experience: pv.experience || [],
            education: pv.education || [],
            postContent: (pv.latestPost as string | undefined) || undefined,
            connectionContext: campaign?.objective || undefined,
            campaignDescription: campaign?.campaignDescription || campaign?.objective || undefined,
            tone: (config as any).tone || campaign?.toneOverride || 'professional',
            // A note that asks for a demo before the invite is even accepted is
            // the fastest way to get ignored — the CTA here is the connection.
            cta: 'connect',
            persona: campaign?.persona || aiContext?.userContext?.persona || undefined,
            valueProposition: campaign?.valueProp || aiContext?.userContext?.valueProp || undefined,
            aiStrategy: aiContext?.aiStrategy,
            userContext: aiContext?.userContext,
            channel: 'linkedin',
            // The per-step instruction the user wrote (if any) layered UNDER the
            // note constraints, so their guidance survives but the length rule
            // that keeps the note sendable wins.
            aiPrompt: [(config as any).aiPrompt, NOTE_INSTRUCTION].filter(Boolean).join(' '),
            campaignProgress: (ctx as any).campaignProgress,
            messageHistory: (ctx as any).messageHistory,
        });

        const generated = (aiResult.message || '').trim();
        if (generated.length > 10) return clampNote(generated, NOTE_HARD_LIMIT);
        console.log('[CONNECT] AI note too short to use — falling back.');
    } catch (err: any) {
        console.log(`[CONNECT] AI note generation failed (${err.message}) — falling back.`);
    }

    return authored || null;
}

export interface NoteAttachResult {
    attached: boolean;
    /** What actually sits in the textarea at submit time (post-cap truncation). */
    text?: string;
    /**
     * Why no note is attached:
     *   'no-note-ui'    — LinkedIn offered no note affordance (allowance spent,
     *                     or this build doesn't support notes for this member).
     *   'not-typed'     — the textarea was there but ended up empty.
     *   'send-disabled' — text went in, but LinkedIn kept Send disabled even at
     *                     the shortest length we try, so the note was cleared
     *                     and the invite should go bare.
     *   'notes-exhausted' — "Add a note" opened the Premium upsell instead of a
     *                     textarea. CRITICAL for the caller: the upsell REPLACES
     *                     the invite modal, so the invite cannot be sent until
     *                     the modal is reopened. We dismiss the upsell; the
     *                     caller must re-click Connect.
     */
    reason?: 'no-note-ui' | 'not-typed' | 'send-disabled' | 'notes-exhausted';
}

/**
 * Free custom notes are exhausted for this account.
 *
 * Proven live 2026-09-16 (DOM captured): clicking "Add a note" with none left
 * opens data-test-modal-id="modal-upsell" — "You're out of free custom notes.
 * Bypass the limit with Premium" — and that modal REPLACES the invite dialog.
 * It has a Dismiss button and a Get-Premium link, and no Send, so the invite is
 * dead until Connect is clicked again. Triggering that once per lead is both
 * wasted work and a needless upsell-impression pattern, so remember it for the
 * process and stop offering notes.
 *
 * In-memory with a TTL rather than a DB column: the allowance resets on
 * LinkedIn's schedule, which we can't see, so the honest model is "assume spent
 * for a while, then try again and find out".
 */
const NOTES_EXHAUSTED_TTL_MS = 12 * 60 * 60 * 1000;
const notesExhaustedAt = new Map<string, number>();

export function notesExhausted(userId: string): boolean {
    const at = notesExhaustedAt.get(userId);
    if (!at) return false;
    if (Date.now() - at > NOTES_EXHAUSTED_TTL_MS) { notesExhaustedAt.delete(userId); return false; }
    return true;
}

export function markNotesExhausted(userId: string): void {
    notesExhaustedAt.set(userId, Date.now());
}

/** The Premium upsell that replaces the invite modal when notes run out. */
const UPSELL_SELECTOR = 'div[data-test-modal-id="modal-upsell"], div.modal-upsell';

/**
 * The modal's Send control. Matched by aria-label first — that's what this
 * build labels it (confirmed live), and it's the only identifier that doesn't
 * also match the messaging overlay's Send button sitting on every page.
 */
const SEND_SELECTOR =
    'button[aria-label="Send invitation"], button[aria-label="Send now"], button:has(span:text-is("Send"))';

/** null when the control can't be read at all. */
async function sendIsDisabled(page: any): Promise<boolean | null> {
    const btn = page.locator(SEND_SELECTOR).first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) return null;
    const state = await btn.evaluate((el: any) =>
        el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('artdeco-button--disabled'),
    ).catch(() => null);
    return state as boolean | null;
}

/**
 * With the invite modal open, put `note` into the note field.
 *
 * Returns rather than throws on every "couldn't" path: the caller should still
 * send the invite. A bare invite is a worse invite, not a failed one.
 */
export async function attachInviteNote(page: any, note: string): Promise<NoteAttachResult> {
    const textareaSel =
        'textarea#custom-message, textarea[name="message"], textarea[id*="custom-message"], '
        + 'div[role="dialog"] textarea, textarea[aria-label*="note" i]';

    let textarea = page.locator(textareaSel).first();
    let visible = await textarea.isVisible({ timeout: 2000 }).catch(() => false);

    if (!visible) {
        // Note field is behind an "Add a note" button on most builds.
        const addNote = page.locator(
            'button[aria-label="Add a note"], '
            + 'button:has(span:text-is("Add a note")), '
            + 'button:has-text("Add a note")',
        ).first();

        if (!(await addNote.isVisible({ timeout: 3000 }).catch(() => false))) {
            return { attached: false, reason: 'no-note-ui' };
        }

        try {
            await addNote.click({ timeout: 6000 });
        } catch (e: any) {
            console.log(`[CONNECT] "Add a note" click refused (${(e?.message || '').split('\n')[0]}) — retrying forced.`);
            await addNote.click({ force: true }).catch(() => {});
        }
        await new Promise(res => setTimeout(res, 1500));

        // Did we get a note field, or the Premium upsell?
        const upsell = page.locator(UPSELL_SELECTOR).first();
        if (await upsell.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Clear it so the profile is usable again. The invite modal is gone
            // with it — the caller has to reopen Connect.
            const dismiss = upsell.locator('button[aria-label="Dismiss"], button.artdeco-modal__dismiss').first();
            if (!(await dismiss.click({ timeout: 4000 }).then(() => true).catch(() => false))) {
                await page.keyboard.press('Escape').catch(() => {});
            }
            await new Promise(res => setTimeout(res, 1200));
            return { attached: false, reason: 'notes-exhausted' };
        }

        textarea = page.locator(textareaSel).first();
        visible = await textarea.isVisible({ timeout: 5000 }).catch(() => false);
        if (!visible) return { attached: false, reason: 'no-note-ui' };
    }

    // Trust LinkedIn's own cap over our constant: builds differ (300 vs 200),
    // and overflow is silently truncated mid-word.
    const maxAttr = parseInt(String(await textarea.getAttribute('maxlength').catch(() => '')) || '', 10);
    const limit = Number.isFinite(maxAttr) && maxAttr > 0
        ? Math.min(maxAttr, NOTE_HARD_LIMIT)
        : ASSUMED_CAP_WHEN_UNDECLARED;
    console.log(`[CONNECT] Note field: maxlength=${Number.isFinite(maxAttr) ? maxAttr : 'absent'} → using ${limit}.`);

    const type = async (text: string): Promise<string> => {
        await textarea.fill(text).catch(() => {});
        let v = String(await textarea.inputValue().catch(() => '') || '');
        if (!v.trim() && text) {
            // fill() sets the value directly; a React-controlled textarea that
            // ignores it still responds to real keystrokes.
            await textarea.click({ timeout: 5000 }).catch(() => {});
            await page.keyboard.type(text, { delay: 12 }).catch(() => {});
            v = String(await textarea.inputValue().catch(() => '') || '');
        }
        await new Promise(res => setTimeout(res, 800));
        return v;
    };

    // Length ladder. When `maxlength` is absent, the page still enforces a cap
    // by DISABLING Send — proven live 2026-09-16: a 237-char note on a build
    // with no maxlength left "Send invitation" disabled, the click timed out,
    // and the invite was never created. So don't just type and hope: type,
    // then ask the Send button whether LinkedIn accepted it, and shorten until
    // it does. 200 is LinkedIn's documented free-account note cap.
    const ladder = [limit, ASSUMED_CAP_WHEN_UNDECLARED, 140]
        .filter((n, i, a) => n > 0 && a.indexOf(n) === i)
        .sort((a, b) => b - a);

    let value = '';
    for (const cap of ladder) {
        value = await type(clampNote(note, cap));
        if (!value.trim()) continue;

        const disabled = await sendIsDisabled(page);
        if (disabled !== true) {
            if (cap !== ladder[0]) console.log(`[CONNECT] Note accepted after shortening to ${cap} chars.`);
            return { attached: true, text: value };
        }
        console.log(`[CONNECT] Send still disabled at ${value.length} chars — shortening.`);
    }

    if (!value.trim()) return { attached: false, reason: 'not-typed' };

    // Every length was rejected. Clear the field so the invite can still go:
    // a non-empty note LinkedIn won't accept blocks Send entirely, which would
    // turn a "no note" situation into "no invite".
    await textarea.fill('').catch(() => {});
    await new Promise(res => setTimeout(res, 800));
    return { attached: false, reason: 'send-disabled' };
}
