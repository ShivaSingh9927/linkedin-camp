import { NodeHandler, NodeResult, ConnectOutput } from '../types';
import { prisma } from '@repo/db';
import { detectConnectionState, extractSlug, isOnLeadProfile } from '../connection-state';
import { syncLeadStatus } from '../safety/lifecycle';

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

export const connect: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead, campaignId } = ctx;

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

        console.log(`[CONNECT] Checking connection status for ${lead.firstName}...`);

        const state = await detectConnectionState(page, lead.linkedinUrl);

        if (state.invitePending) {
            console.log(`[CONNECT] Connection already pending (${state.pendingAriaLabel}).`);
            output.status = 'pending';
            if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'pending');
            return { success: true, output };
        }

        if (state.isDmable) {
            // composeUrl present — either 1st-degree or Open Profile. Either
            // way no invite is needed; treat as already_connected so the
            // downstream send-message step proceeds.
            console.log('[CONNECT] Already DMable (1st-degree or Open Profile).');
            output.status = 'already_connected';
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

        if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Use evaluate to bypass sticky headers (like testscripts)
            await connectBtn.evaluate((el: any) => el.click());
            console.log('[CONNECT] Connect button clicked, waiting for modal...');
            await wait(randomRange(3000, 4000));

            // Handle the modal — click Send (like testscripts pattern)
            const sendBtn = page.locator(
                'button[aria-label="Send now"], ' +
                'button:has(span:text-is("Send without a note")), ' +
                'button:has(span:text-is("Send")), ' +
                'button[aria-label="Send invitation"], ' +
                'button:has-text("Send now")'
            ).first();

            if (!(await sendBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
                // The old code pressed Enter here and then called it sent when
                // the URL lacked "connect"/"invitation" — words a profile URL
                // never contains, so that branch passed unconditionally and
                // invented invitations that were never sent. No Send button is
                // simply a failure.
                return { success: false, error: 'Connect modal opened but Send button not found' };
            }

            await sendBtn.evaluate((el: any) => el.click());
            await wait(randomRange(2500, 4000));

            // PROVE it. Clicking Send is not evidence the invite exists —
            // Qampi showed leads as invited while LinkedIn showed no pending
            // invitation.
            //
            // This was written to ask Voyager (browser-free), but every
            // invitation REST route is gone: invitationViews?q=sentInvitation,
            // sentInvitationViewsV2, normInvitations and relationships/invitations
            // all 400, and the profileView/networkinfo routes 410 — verified
            // against a live session on 2026-09-15. What remains is GraphQL
            // behind rotating queryIds, the same unreliable dependency
            // post-discovery already refuses to take. So the evidence is the
            // profile itself, which is already on screen: after a successful
            // invite LinkedIn swaps the action to a Pending state.
            //
            // Polled rather than checked once — the swap is a client-side
            // re-render and a single immediate look reports a false negative.
            let pending = false;
            for (let attempt = 0; attempt < 4 && !pending; attempt++) {
                pending = await page
                    .locator('button:has-text("Pending"), span:text-is("Pending"), button[aria-label*="Pending"]')
                    .first()
                    .isVisible({ timeout: 2500 })
                    .catch(() => false);
                if (!pending && attempt < 3) await wait(2000);
            }

            if (!pending) {
                // No Pending state means LinkedIn did not register an invite.
                // Reporting failure is safe to retry: the node's own
                // already-pending/connected guard makes a later re-run a no-op
                // if the invite did in fact land, and only SUCCESS rows count
                // against the daily invite cap.
                console.log('[CONNECT] Send clicked but profile never showed Pending — reporting failure.');
                return { success: false, error: 'Invite not confirmed (no Pending state after sending)' };
            }

            (output as any).verified = true;
            output.status = 'sent';
            console.log('[CONNECT] Connection request sent (Pending confirmed on profile).');

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
