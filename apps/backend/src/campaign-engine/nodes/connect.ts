import { NodeHandler, NodeResult, ConnectOutput } from '../types';
import { prisma } from '@repo/db';
import { detectConnectionState, extractSlug, isOnLeadProfile } from '../connection-state';
import { syncLeadStatus } from '../safety/lifecycle';
import { getMemberRelationship } from '../../services/voyager-api.service';
import { buildInviteNote, attachInviteNote, notesExhausted, markNotesExhausted, NoteAttachResult } from './invite-note';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function safeGoto(page: any, url: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            return true;
        } catch (err: any) {
            if (i === retries - 1) throw err;
            await wait(3000);
        }
    }
}

export const connect: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, campaignId, userId, apiRequest } = ctx;

    const output: ConnectOutput = { status: 'failed' };

    try {
        if (!page) return { success: false, error: 'connect requires a live Page' };
        if (!lead.linkedinUrl) return { success: false, error: 'Lead has no linkedinUrl' };

        const slug = extractSlug(lead.linkedinUrl);
        if (!slug) return { success: false, error: `Could not extract slug from ${lead.linkedinUrl}` };

        // Navigate to the lead FIRST. Every other write node does this; connect
        // was the only one that didn't — it ran detectConnectionState (whose own
        // header says it "assumes already navigated to") against whatever page
        // happened to be open. After a lazy browser launch that is /feed/, so
        // the whole node was operating on the wrong page: 13 of the last 15
        // connect attempts logged "Connect button not found on profile", and the
        // 2 that succeeded predate the Voyager profile-visit switch, back when a
        // DOM profile-visit happened to leave the right page open.
        console.log(`[CONNECT] Navigating to ${lead.firstName}'s profile...`);
        await safeGoto(page, lead.linkedinUrl);
        await wait(randomRange(3000, 5000));

        // Confirm we actually landed on THIS lead before touching any button.
        // A redirect — deleted profile, login wall, checkpoint interstitial —
        // would otherwise leave us clicking Connect on whatever LinkedIn served
        // instead, which is how an invite reaches the wrong person.
        const landedUrl = page.url();
        if (!isOnLeadProfile(landedUrl, lead.linkedinUrl)) {
            return {
                success: false,
                error: `Not on the lead's profile after navigation (url=${landedUrl}, expected slug=${slug}) — refusing to click Connect`,
            };
        }

        // Did WE withdraw an invite to this person recently?
        //
        // LinkedIn refuses to let a withdrawn invitation be resent for THREE
        // WEEKS. Without this check the pair of features fight each other: the
        // withdraw job clears the outstanding pile, the campaign re-invites the
        // same people days later, every attempt fails, and the failures look
        // like a broken connect node. Terminal, not a retry — time is the only
        // thing that fixes it.
        const withdrawn = await prisma.actionLog.findFirst({
            where: {
                userId, leadId: lead.id, actionType: 'invite-withdrawn', status: 'SUCCESS',
                executedAt: { gte: new Date(Date.now() - 21 * 86_400_000) },
            },
            select: { executedAt: true },
        }).catch(() => null);
        if (withdrawn) {
            const days = Math.ceil((withdrawn.executedAt.getTime() + 21 * 86_400_000 - Date.now()) / 86_400_000);
            console.log(`[CONNECT] Invite to ${lead.firstName} was withdrawn ${new Date(withdrawn.executedAt).toISOString().slice(0, 10)} — LinkedIn blocks a resend for ~${days} more day(s).`);
            return {
                success: false, terminal: true, terminalReason: 'invite_withdrawn_cooldown',
                error: `Invite was withdrawn recently; LinkedIn blocks resending for about ${days} more days.`,
            };
        }

        console.log(`[CONNECT] Checking connection status for ${lead.firstName}...`);

        // Ask LinkedIn what the relationship IS before trusting the page.
        //
        // The DOM heuristic guesses "DMable" from a document-wide query for a
        // compose link (connection-state.ts), so any compose affordance
        // anywhere on the page — a More menu, a sidebar module — reads as
        // "already connected". Proven 2026-09-15: Vignesh and Disha both hit
        // that branch, so no invite was ever sent, and the lead was stamped
        // connected while LinkedIn reported DISTANCE_2 with NoInvitation. That
        // is exactly the "Qampi says connected, LinkedIn doesn't" report.
        //
        // The topcard read is authoritative for both degree and invite state,
        // so it decides; the DOM is only consulted when Voyager can't answer.
        const rel = await getMemberRelationship(userId, slug, page, apiRequest).catch(() => null);
        if (rel) {
            console.log(`[CONNECT] LinkedIn says distance=${rel.distance ?? '?'} pendingInvite=${rel.pendingInvite}`);

            if (rel.pendingInvite === true) {
                console.log('[CONNECT] Invitation already pending — nothing to send.');
                output.status = 'pending';
                if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'pending');
                return { success: true, output };
            }
            if (rel.connected) {
                console.log('[CONNECT] Already a 1st-degree connection.');
                output.status = 'already_connected';
                if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'connected');
                await prisma.lead.update({ where: { id: lead.id }, data: { connectionDegree: 1 } }).catch(() => {});
                return { success: true, output };
            }
            // 2nd/3rd degree with no invite pending: an invite IS needed, even
            // if the profile offers a Message button (Open Profile members are
            // messageable but NOT connected). Fall through and send it.
        }

        const state = await detectConnectionState(page, lead.linkedinUrl);

        if (state.invitePending) {
            console.log(`[CONNECT] Connection already pending (${state.pendingAriaLabel}).`);
            output.status = 'pending';
            if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'pending');
            return { success: true, output };
        }

        if (state.isDmable && !rel) {
            // composeUrl present — either 1st-degree or Open Profile. Either
            // way no invite is needed; treat as already_connected so the
            // downstream send-message step proceeds.
            // Only reachable when Voyager could not answer. "DMable" spans
            // 1st-degree AND Open Profile, and the latter is messageable but
            // NOT a connection — so record 'dmable', not 'connected'. Writing
            // 'connected' here is what put a connection in the UI that did not
            // exist on LinkedIn.
            console.log('[CONNECT] DMable per DOM (Voyager unavailable) — messageable, not necessarily connected.');
            output.status = 'already_connected';
            // NOTE: still recorded as 'connected' because the downstream
            // messaging gate routes Open-Profile leads on that value, and
            // narrowing it here without retesting that path would silently
            // drop them. The label is imprecise for Open Profile; the Voyager
            // branch above now handles the real cases, so this is the rare
            // fallback rather than the norm it used to be.
            if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'connected');
            // Record REAL acceptance for reporting only when they're genuinely
            // 1st-degree. Open Profile is DMable but 2nd-degree — messageable, NOT
            // a connection — so leave its degree untouched. syncLeadStatus counts
            // CONNECTED off connectionDegree===1, so this keeps the count honest.
            if (state.connectionDegree === 1) {
                await prisma.lead.update({ where: { id: lead.id }, data: { connectionDegree: 1 } }).catch(() => {});
            }
            return { success: true, output };
        }

        // If the page rendered but showed none of the three known states, we do
        // NOT know what we're looking at. The old code fell through to a blind
        // click here; that's precisely the path that could invite a stranger.
        // Fail instead — a missed invite is recoverable, a wrong one isn't.
        if (state.isUnknown) {
            return {
                success: false,
                error: 'Connection state unknown on the lead profile (no compose link, no slug-bound invite link, no pending badge) — refusing to click Connect',
            };
        }

        // Slug-bound Connect button.
        //
        // The old selector was `[aria-label*="to connect"]`.first() — bound to
        // NOBODY, and page-wide. detectConnectionState already goes to the
        // trouble of binding its own lookup to the lead's vanity slug (see its
        // "so we never pick up the connect link for a People you may know card"
        // comment); this used to throw that guarantee away one line later.
        //
        // Order: the exact href detectConnectionState resolved → the slug-bound
        // invite link → main-scoped aria-label (the profile's own action bar;
        // "People also viewed"/"People you may know" render in <aside>).
        const slugInvite = `a[href*="/preload/custom-invite/?vanityName=${slug}"]`;
        let connectBtn = state.connectHref
            ? page.locator(`main ${slugInvite}, ${slugInvite}`).first()
            : page.locator(`${slugInvite}, main [aria-label*="to connect"]`).first();

        if (!(await connectBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            // "More" menu — scoped to the profile action bar, not the whole page.
            const moreBtn = page.locator('main button:has(span:text-is("More"))').first();
            if (await moreBtn.isVisible().catch(() => false)) {
                await moreBtn.evaluate((el: any) => el.click());
                await wait(randomRange(1500, 2000));
                // Inside the opened dropdown only. Combined with the URL check
                // above, this can't reach another member's card.
                connectBtn = page.locator(
                    `${slugInvite}, ` +
                    'div[role="menu"] a[role="menuitem"]:has-text("Connect"), ' +
                    'div[role="menu"] div[role="button"]:has-text("Connect")'
                ).first();
            }
        }

        // Reopen the invite modal from scratch.
        //
        // The upsell recovery used to re-click `connectBtn`, which is fine when
        // that locator is the profile's own invite link — but when the Connect
        // control was only reachable through the "More" dropdown, the locator
        // points INSIDE a menu that closed the moment the first modal opened.
        // Re-clicking it then resolves to nothing, the click is swallowed by its
        // .catch, no dialog appears, and the invite dies as the generic
        // "Send button not found". Redo the whole sequence instead, and confirm
        // a dialog actually came back rather than assuming it.
        const reopenInvite = async (): Promise<boolean> => {
            let btn = page.locator(`main ${slugInvite}, ${slugInvite}`).first();
            if (!(await btn.isVisible({ timeout: 4000 }).catch(() => false))) {
                const more = page.locator('main button:has(span:text-is("More"))').first();
                if (await more.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await more.evaluate((el: any) => el.click()).catch(() => {});
                    await wait(randomRange(1500, 2000));
                    btn = page.locator(
                        `${slugInvite}, ` +
                        'div[role="menu"] a[role="menuitem"]:has-text("Connect"), ' +
                        'div[role="menu"] div[role="button"]:has-text("Connect")'
                    ).first();
                }
            }
            if (!(await btn.isVisible({ timeout: 4000 }).catch(() => false))) return false;
            await btn.evaluate((el: any) => el.click()).catch(() => {});
            await wait(randomRange(2500, 3500));
            return await page.locator('div[role="dialog"], .artdeco-modal')
                .first().isVisible({ timeout: 5000 }).catch(() => false);
        };

        if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Resolve the note BEFORE opening the modal — LinkedIn's invite
            // dialog is short-lived and an AI round-trip inside it invites a
            // stale-handle click. Null means this step is configured for a bare
            // invite, which is a legitimate (often better-converting) choice.
            // Don't even generate one if this account is known to be out of free
            // custom notes — that costs an LLM call and then trips the upsell,
            // which destroys the invite modal (see below).
            const note = notesExhausted(userId)
                ? null
                : await buildInviteNote(ctx, config || {}).catch(() => null);
            if (note) console.log(`[CONNECT] Invite note ready (${note.length} chars): "${note.slice(0, 60)}..."`);
            else if (notesExhausted(userId)) console.log('[CONNECT] Skipping the note — this account is out of free custom notes.');

            // Use evaluate to bypass sticky headers (like testscripts)
            await connectBtn.evaluate((el: any) => el.click());
            console.log('[CONNECT] Connect button clicked, waiting for modal...');
            await wait(randomRange(3000, 4000));

            // Type the note into the modal, when there is one to type. Failure
            // to attach is NOT a failure to invite: note-invites are rationed on
            // free accounts, and when the allowance is gone LinkedIn just stops
            // offering the field. Record what actually happened either way —
            // claiming a note that never attached is the same class of lie as
            // claiming an invite that was never sent.
            let noteAttached = false;
            let noteSent: string | undefined;
            if (note) {
                const res: NoteAttachResult = await attachInviteNote(page, note)
                    .catch(() => ({ attached: false, reason: 'not-typed' as const }));
                noteAttached = res.attached;
                noteSent = res.text;
                const why = res.reason === 'no-note-ui'
                    ? 'LinkedIn offered no note field — note allowance likely spent'
                    : res.reason === 'send-disabled'
                        ? 'LinkedIn refused the note at every length and kept Send disabled — note cleared'
                        : res.reason === 'notes-exhausted'
                            ? 'out of free custom notes — LinkedIn offered Premium instead'
                            : 'note field would not accept text';
                console.log(res.attached
                    ? `[CONNECT] Note attached (${res.text?.length} chars after LinkedIn's cap).`
                    : `[CONNECT] Sending WITHOUT a note (${why}).`);

                // The upsell REPLACED the invite modal — there is no Send button
                // on the page any more, so without reopening, this invite (and
                // every later one) fails. Live 2026-09-16: 8 of 10 leads failed
                // exactly here, each reported honestly as "Send button not
                // found" with no invite created.
                if (res.reason === 'notes-exhausted') {
                    markNotesExhausted(userId);
                    console.log('[CONNECT] Upsell dismissed — reopening the invite to send it bare.');
                    if (!(await reopenInvite())) {
                        return {
                            success: false,
                            error: 'connect: the note upsell replaced the invite modal and it could not be reopened',
                        };
                    }
                }
            }

            // Handle the modal — click Send.
            //
            // SCOPE THIS TO THE DIALOG. A page-wide `button:has(span:text-is
            // ("Send"))` also matches the messaging overlay's Send button,
            // which sits in the DOM on every page and is not clickable here.
            // Proven 2026-09-16 on Vrinda: note attached fine, then the click
            // timed out at 8s and the invite never existed — the same
            // wrong-element failure the comment node had. The old no-note path
            // was accidentally immune because "Send without a note" exists
            // only inside this dialog.
            //
            // With a note typed, "Send without a note" must also NOT be in the
            // list: it's still in the DOM on some builds and would discard the
            // note we just wrote.
            const sendSelector = noteAttached
                ? 'button[aria-label="Send invitation"], '
                    + 'button[aria-label="Send now"], '
                    + 'button:has(span:text-is("Send")), '
                    + 'button:has-text("Send now")'
                : 'button[aria-label="Send now"], '
                    + 'button:has(span:text-is("Send without a note")), '
                    + 'button:has(span:text-is("Send")), '
                    + 'button[aria-label="Send invitation"], '
                    + 'button:has-text("Send now")';

            const dialog = page.locator('div[role="dialog"], .artdeco-modal').first();
            const inDialog = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
            const sendBtn = (inDialog ? dialog.locator(sendSelector) : page.locator(sendSelector)).first();
            if (!inDialog) console.log('[CONNECT] No invite dialog found — falling back to a page-wide Send lookup.');

            // Say WHICH control we're about to click. When this fails again,
            // the log should name the element rather than leave us guessing
            // between "wrong button" and "right button, blocked".
            const btnDesc = await sendBtn.evaluate((el: any) => {
                const r = el.getBoundingClientRect();
                return `text="${(el.textContent || '').trim().slice(0, 30)}" aria="${el.getAttribute('aria-label') || ''}" `
                    + `disabled=${!!el.disabled} box=${Math.round(r.width)}x${Math.round(r.height)}`;
            }).catch(() => 'unreadable');
            console.log(`[CONNECT] Send target: ${btnDesc}`);

            if (!(await sendBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
                // SAY WHAT LINKEDIN IS ACTUALLY SHOWING. "Send button not
                // found" is the same unhelpful sentence whether the modal is an
                // invite dialog that rendered oddly, a weekly-invite-limit
                // notice, or a premium upsell — and those need completely
                // different responses. Dump the modal's text and its buttons so
                // the next failure is diagnosable from logs alone.
                // NOTE: read this through Playwright locators, not
                // page.evaluate + document.querySelector. LinkedIn renders the
                // invite modal inside #interop-outlet's OPEN SHADOW ROOT, which
                // document.querySelector does not pierce (Playwright's CSS
                // engine does) — an evaluate-based dump reports an empty page
                // and sends you hunting for the wrong bug.
                const dlg = page.locator('div[role="dialog"], .artdeco-modal').first();
                const dlgText = ((await dlg.innerText({ timeout: 3000 }).catch(() => '')) || '')
                    .replace(/\s+/g, ' ').trim().slice(0, 240);
                const labels = await page.locator('div[role="dialog"] button, .artdeco-modal button')
                    .evaluateAll((els: any[]) => els.slice(0, 12).map((b: any) =>
                        `${(b.textContent || '').trim().slice(0, 28)}|${b.getAttribute('aria-label') || ''}|${b.disabled ? 'disabled' : 'enabled'}`))
                    .catch(() => [] as string[]);
                console.log(`[CONNECT] No Send control. Modal text: "${dlgText || '(none)'}"`);
                console.log(`[CONNECT] Modal buttons: ${JSON.stringify(labels)}`);

                // The old code pressed Enter here and then called it sent when
                // the URL lacked "connect"/"invitation" — words a profile URL
                // never contains, so that branch passed unconditionally and
                // invented invitations that were never sent. No Send button is
                // simply a failure.
                // Persist WHAT LINKEDIN SHOWED, not just the symptom. This dump
                // existed already but went to stdout only, so ActionLog stored
                // the same generic sentence for ten failures across five days
                // and the container logs were rotated away before anyone read
                // them. The error string is the only forensics that survives.
                const known = /weekly invitation limit|invitation limit|try again (next week|later)/i.test(dlgText)
                    ? 'weekly-invite-limit'
                    : /premium|upgrade/i.test(dlgText)
                        ? 'premium-upsell'
                        : 'unknown-modal';
                return {
                    success: false,
                    error: `Connect modal opened but Send button not found [${known}] `
                        + `modal="${dlgText || '(empty)'}" buttons=${JSON.stringify(labels).slice(0, 220)}`,
                };
            }

            // Trusted click WITH the actionability check. evaluate()-dispatched
            // clicks are untrusted and React form handlers can ignore them, and
            // force:true would skip the "element is covered by another element"
            // check — the exact combination that let the comment node click a
            // messaging overlay for five attempts while reporting success. Let an
            // interception throw and say so; force only as a logged fallback.
            try {
                await sendBtn.click({ timeout: 8000 });
            } catch (e: any) {
                const why = (e?.message || '').split('\n')[0];
                console.log(`[CONNECT] Send click refused (${why}) — retrying forced.`);
                await sendBtn.click({ force: true });
            }
            await wait(randomRange(2500, 4000));

            // PROVE it. Clicking Send is not evidence the invite exists —
            // Qampi showed leads as invited while LinkedIn showed nothing.
            //
            // Ask LinkedIn, browser-free: the dash topcard returns the
            // invitation union, which names the state outright (NoInvitation
            // when nothing is pending). Verified 2026-09-15 — the three leads
            // this node had reported as "sent" all came back NoConnection +
            // NoInvitation, i.e. the invites were never created.
            //
            // Polled: the relationship read is eventually consistent, so one
            // immediate look can miss an invite that did land.
            let confirmed: boolean | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {   // breaks out on a confirmed invite
                await wait(attempt === 0 ? 1500 : 2500);
                const rel = await getMemberRelationship(userId, slug, page, apiRequest).catch(() => null);
                if (!rel) continue;                      // couldn't ask
                if (rel.connected) { confirmed = true; break; }   // already 1st-degree
                if (rel.pendingInvite === true) { confirmed = true; break; }
                if (rel.pendingInvite === false) confirmed = false;
            }

            if (confirmed === null) {
                // Voyager unavailable — fall back to the profile in front of us.
                const pendingVisible = await page
                    .locator('button:has-text("Pending"), span:text-is("Pending"), button[aria-label*="Pending"]')
                    .first()
                    .isVisible({ timeout: 4000 })
                    .catch(() => false);
                confirmed = pendingVisible ? true : null;
                console.log(`[CONNECT] Voyager inconclusive; DOM pending indicator: ${pendingVisible}`);
            }

            if (confirmed !== true) {
                // Safe to fail: the node's own already-pending/connected guard
                // makes a later re-run a no-op if the invite did land, and only
                // SUCCESS rows count toward the daily invite cap.
                console.log('[CONNECT] LinkedIn shows no pending invitation after Send — reporting failure.');
                return { success: false, error: 'Invite not confirmed on LinkedIn after sending' };
            }

            (output as any).verified = true;
            output.status = 'sent';
            output.noteAttached = noteAttached;
            if (noteAttached) output.note = noteSent;
            console.log(`[CONNECT] Connection request sent (confirmed on LinkedIn)${noteAttached ? ' with a note' : ''}.`);

            if (campaignId) {
                await updateConnectionStatus(campaignId, lead.id, 'pending');
            }
            return { success: true, output };
        } else {
            return { success: false, error: 'Connect button not found on profile' };
        }

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

async function updateConnectionStatus(campaignId: string, leadId: string, status: 'connected' | 'pending' | 'not_connected') {
    try {
        await prisma.campaignLeadProgress.upsert({
            where: {
                campaignId_leadId: {
                    campaignId,
                    leadId
                }
            },
            create: {
                campaignId,
                leadId,
                connectionStatus: status,
                currentNodeIndex: 0,
                needsRetry: status === 'not_connected'
            },
            update: {
                connectionStatus: status,
                lastConnectionCheck: new Date(),
                needsRetry: status === 'not_connected',
                updatedAt: new Date()
            }
        });
        // Re-project the coarse dashboard/copilot status from this new connection
        // truth (single writer). 'pending' → PENDING, 'connected' → CONNECTED.
        await syncLeadStatus(campaignId, leadId);
        console.log(`[CONNECT] Updated connection status to: ${status}`);
    } catch (err) {
        console.log(`[CONNECT] Could not update progress: ${err}`);
    }
}
