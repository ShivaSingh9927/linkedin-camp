import { prisma } from '@repo/db';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { extractSlug } from '../campaign-engine/connection-state';

/**
 * Withdraw stale outstanding invitations.
 *
 * WHY THIS MATTERS NOW. The engine refuses to send new invites once a user has
 * OUTSTANDING_INVITE_CAP (300) unanswered — LinkedIn punishes a big unanswered
 * pile harder than anything else it does about invitations (its help page says
 * up to a MONTH, versus about a week for everything else). But a ceiling with
 * no way to come back down is a dead end: the user is simply stopped, with no
 * remedy. This is the remedy.
 *
 * THE COST IS REAL, so this is conservative by default. A withdrawn invitation
 * CANNOT BE RESENT FOR THREE WEEKS — LinkedIn's own rule. Withdrawing is
 * therefore only correct for invites old enough to be dead anyway: acceptances
 * overwhelmingly arrive inside a fortnight.
 *
 * HISTORY — why it is written this way:
 *  - It used to hand-roll its own Chromium launch and read `(user as any).proxy`
 *    behind a @ts-ignore. findUnique loads no relations, so that was ALWAYS
 *    undefined: the browser launched with NO PROXY, from the datacenter IP,
 *    with the user's real cookies. Run nightly across every user, it killed
 *    sessions for weeks. launchAuthenticatedContext is now the only launch path.
 *  - It then selected cards by `.invitation-card` and clicked through
 *    page.evaluate. Both are wrong on today's LinkedIn: the invitation manager
 *    renders inside an OPEN SHADOW ROOT, which document.querySelector does not
 *    pierce (Playwright's CSS engine does), and evaluate-dispatched clicks are
 *    untrusted, so React handlers can ignore them.
 *  - And it never wrote anything back, so our own records still showed the
 *    invites as outstanding — the exact number the cap counts.
 *
 * Targets come from OUR database, matched to cards by profile slug, rather than
 * from parsing "2 months ago" out of the page. We know precisely when each
 * invite was sent; the relative-time text is a lossy restatement of that.
 */

export interface WithdrawResult {
    ok: boolean;
    /** How many of our pending invites were older than the threshold. */
    eligible: number;
    /** How many of those were found on the invitation-manager page. */
    matched: number;
    withdrawn: number;
    dryRun: boolean;
    reason?: string;
    /** Slugs acted on (or that WOULD be acted on in a dry run). */
    slugs: string[];
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * @param olderThanDays only invites sent at least this long ago (default 30)
 * @param max           ceiling per run — withdrawing hundreds in one burst is
 *                      itself unusual behaviour
 * @param dryRun        find and report, click nothing. DEFAULT TRUE: the action
 *                      is irreversible for three weeks, so it must be asked for.
 */
export async function withdrawStaleInvites(
    userId: string,
    { olderThanDays = 30, max = 20, dryRun = true }: { olderThanDays?: number; max?: number; dryRun?: boolean } = {},
): Promise<WithdrawResult> {
    const empty: WithdrawResult = { ok: true, eligible: 0, matched: 0, withdrawn: 0, dryRun, slugs: [] };

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedinCookie: true, sessionInvalid: true, accountHealth: true },
    });
    if (!user?.linkedinCookie) return { ...empty, ok: false, reason: 'no_session' };
    if (user.sessionInvalid || (user.accountHealth && user.accountHealth !== 'HEALTHY')) {
        return { ...empty, ok: false, reason: `unhealthy_account:${user.accountHealth}` };
    }

    // ── Who is eligible, per our own records ────────────────────────────────
    const campaigns = await prisma.campaign
        .findMany({ where: { userId }, select: { id: true } })
        .catch(() => [] as Array<{ id: string }>);
    if (!campaigns.length) return empty;

    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const stale = await prisma.campaignLeadProgress.findMany({
        where: {
            campaignId: { in: campaigns.map((c) => c.id) },
            connectionStatus: 'pending',
            updatedAt: { lt: cutoff },
        },
        orderBy: { updatedAt: 'asc' },   // oldest first — deadest first
        take: max,
        select: { id: true, leadId: true, campaignId: true, updatedAt: true },
    }).catch(() => [] as any[]);

    if (!stale.length) {
        console.log(`[WITHDRAW] user ${userId}: no invites older than ${olderThanDays}d.`);
        return empty;
    }

    const leads = await prisma.lead.findMany({
        where: { id: { in: stale.map((s: any) => s.leadId) } },
        select: { id: true, linkedinUrl: true, firstName: true },
    }).catch(() => [] as any[]);

    // slug → our progress row, so a matched card maps straight back to the DB.
    const bySlug = new Map<string, { progressId: string; leadId: string; campaignId: string; name: string }>();
    for (const s of stale as any[]) {
        const lead = leads.find((l: any) => l.id === s.leadId);
        const slug = lead?.linkedinUrl ? extractSlug(lead.linkedinUrl) : null;
        if (slug) bySlug.set(slug.toLowerCase(), {
            progressId: s.id, leadId: s.leadId, campaignId: s.campaignId, name: lead.firstName || s.leadId,
        });
    }
    if (!bySlug.size) return { ...empty, eligible: stale.length, reason: 'no_resolvable_slugs' };

    console.log(`[WITHDRAW] user ${userId}: ${bySlug.size} invite(s) older than ${olderThanDays}d${dryRun ? ' (DRY RUN)' : ''}.`);

    // ── Drive the page ──────────────────────────────────────────────────────
    let browser: any;
    try {
        const launch = await launchAuthenticatedContext(userId);
        if (!launch.ok) return { ...empty, ok: false, eligible: bySlug.size, reason: `launch_${launch.failedAt}` };
        browser = launch.browser;
        const { context, page } = launch as any;

        // Bandwidth: the invitation manager is a list of avatars we don't need.
        await context.route('**/*', (route: any) => {
            const t = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(t)) return route.abort();
            return route.continue();
        });

        await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', {
            waitUntil: 'domcontentloaded', timeout: 60000,
        });
        await wait(4000);

        const url = page.url();
        if (/\/(uas\/)?login|authwall|checkpoint/i.test(url)) {
            // "Nothing to withdraw" and "we were bounced to a login page" must
            // never look the same — that confusion hid the unproxied-launch bug
            // for weeks.
            return { ...empty, ok: false, eligible: bySlug.size, reason: 'authwall' };
        }

        // Scroll until the count stops growing: this page paginates, and the
        // user this remedy exists FOR is sitting at the 300 ceiling, where
        // clearing only the first screen would be useless.
        //
        // (Measured on rajaji 2026-09-19 the count did NOT grow — 7 links was
        // the true total. Our records claimed 11 pending; the extra 4 were the
        // profiles the nightly reconcile could not read, and this page proves
        // they are no longer outstanding. Which makes the sent-invitations list
        // a better reconciler than the topcard for exactly those cases —
        // absence from this list IS the answer. Worth a follow-up.)
        const links = page.locator('a[href*="/in/"]');
        let count = await links.count().catch(() => 0);
        for (let pass = 0; pass < 12; pass++) {
            await page.mouse.wheel(0, 2200);
            await wait(1200);
            const next = await links.count().catch(() => count);
            if (next <= count) break;          // nothing new loaded — we're at the end
            count = next;
        }
        console.log(`[WITHDRAW] invitation manager shows ${count} profile link(s) after scrolling.`);

        const targets: Array<{ slug: string; index: number }> = [];
        for (let i = 0; i < count; i++) {
            const href = (await links.nth(i).getAttribute('href').catch(() => '')) || '';
            const m = href.match(/\/in\/([^/?#]+)/);
            const slug = m ? decodeURIComponent(m[1]).toLowerCase() : '';
            if (slug && bySlug.has(slug) && !targets.some((t) => t.slug === slug)) {
                targets.push({ slug, index: i });
            }
        }

        if (!targets.length) {
            console.log('[WITHDRAW] none of our stale invites appear on the page (already gone, or paginated further down).');
            return { ...empty, eligible: bySlug.size, matched: 0 };
        }

        if (dryRun) {
            console.log(`[WITHDRAW] DRY RUN — would withdraw: ${targets.map((t) => t.slug).join(', ')}`);
            return { ...empty, eligible: bySlug.size, matched: targets.length, slugs: targets.map((t) => t.slug) };
        }

        let withdrawn = 0;
        const done: string[] = [];
        for (const t of targets) {
            // The Withdraw button for THIS invite: walk up from the profile link
            // to the card that contains both. Structural, not class-based —
            // LinkedIn ships obfuscated class names on some builds.
            const card = links.nth(t.index).locator(
                'xpath=ancestor::*[.//button[contains(translate(., "WITHDRAW", "withdraw"), "withdraw")]][1]',
            );
            const button = card.locator('button').filter({ hasText: /withdraw/i }).first();

            if (!(await button.isVisible({ timeout: 4000 }).catch(() => false))) {
                console.log(`[WITHDRAW] no Withdraw control next to ${t.slug} — skipping.`);
                continue;
            }
            await button.click({ timeout: 8000 }).catch(async () => { await button.click({ force: true }); });
            await wait(1200);

            // Confirmation dialog, when the build shows one.
            const confirm = page.locator(
                'button[aria-label*="Withdraw" i], div[role="dialog"] button:has-text("Withdraw")',
            ).first();
            if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) {
                await confirm.click({ timeout: 6000 }).catch(() => {});
            }
            await wait(randomPause());

            withdrawn++;
            done.push(t.slug);

            // Write it back IMMEDIATELY, per invite. The old version updated
            // nothing, so our records kept counting withdrawn invites as
            // outstanding — which is the number the cap gates on. Batching this
            // to the end would lose the lot if the page died mid-run.
            const row = bySlug.get(t.slug)!;
            await prisma.campaignLeadProgress.update({
                where: { id: row.progressId },
                data: { connectionStatus: 'not_connected', lastConnectionCheck: new Date() },
            }).catch(() => {});
            // An ActionLog row is how connect knows not to re-invite this person
            // for three weeks (LinkedIn refuses, and trying looks like a bot).
            await prisma.actionLog.create({
                data: {
                    userId, campaignId: row.campaignId, leadId: row.leadId,
                    actionType: 'invite-withdrawn', status: 'SUCCESS',
                },
            }).catch(() => {});
            console.log(`[WITHDRAW] withdrew invite to ${t.slug} (${row.name}).`);
        }

        return { ok: true, eligible: bySlug.size, matched: targets.length, withdrawn, dryRun: false, slugs: done };
    } catch (err: any) {
        console.error('[WITHDRAW] failed:', err?.message || err);
        return { ...empty, ok: false, eligible: bySlug.size, reason: err?.message };
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

/** 4–9s between withdrawals — a burst of them is itself unusual behaviour. */
const randomPause = () => Math.floor(Math.random() * 5000) + 4000;

/** Back-compat for the existing cron caller. Cron never clicks unless asked. */
export const withdrawOldInvites = (userId: string, olderThanDays = 30) =>
    withdrawStaleInvites(userId, { olderThanDays, dryRun: process.env.WITHDRAW_LIVE !== 'true' });
