/**
 * profile-visit-voyager.ts
 *
 * HYBRID profile-visit that uses Voyager API (HTTP) for fields LinkedIn exposes
 * on the read path, and falls back to DOM automation only for fields the API
 * never returns (1st-degree contact info, recent posts). Identical output
 * shape to `profile-visit.ts` so the engine and downstream consumers don't
 * need to know which path ran.
 *
 * What the API gives us (per session warm-up + ~300ms call):
 *   - firstName, lastName, headline, vanity
 *   - summary/about (multiLocale)
 *   - location, industry
 *   - profile picture URL (vector image, 200x200 artifact)
 *   - memberId (from objectUrn)
 *
 * What the API does NOT give us (require DOM):
 *   - email, phone, connectedDate (1st-degree contact-info modal only)
 *   - latest post content (needs /recent-activity/shares/ nav)
 *   - exact 1st/2nd/3rd-degree badge (FullProfile doesn't return it)
 *
 * So the algorithm is:
 *   1. Call FullProfile-76 → get all the easy stuff.
 *   2. If lead is 1st-degree AND `enrichContact` is set → DOM modal click
 *      (rare; only for the small subset of leads in the user's network).
 *   3. If `enrichPosts` is set → DOM /recent-activity nav + scrape.
 *
 * The point: the 719-row CSV enrichment (no contact, no posts) goes from
 * ~15s/lead (full profile nav + scroll + extract) to ~300ms/lead.
 */
import { NodeHandler, NodeResult, ProfileVisitOutput } from '../types';
import { prisma } from '@repo/db';
import {
    getProfileByFsd,
    isFirstDegree,
    getAllConnections,
} from '../../services/voyager-api.service';
import { cleanPersonField } from '../scrape/sanitize';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const profileVisitVoyager: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, userId, campaignId } = ctx;
    const enrichContact = !!(config as any).enrichContact;
    const enrichPosts = !!(config as any).enrichPosts;

    const output: ProfileVisitOutput = {
        name: null,
        headline: null,
        location: null,
        company: null,
        jobTitle: null,
        companyUrl: null,
        about: null,
        email: null,
        phone: null,
        connected: false,
        connectedDate: null,
        experience: [],
        education: [],
        latestPost: null,
        latestPostUrl: null,
    };

    try {
        if (!page) {
            return { success: false, error: 'profile-visit-voyager requires a live Page (no page in context)' };
        }
        if (!lead.linkedinUrl) {
            return { success: false, error: 'Lead has no linkedinUrl' };
        }

        // ---- Step 1: Resolve vanity → fsdUrn ----
        // Voyager's FullProfile-76 takes an fsd_profile URN, not a vanity.
        // The cleanest way to get it is to scrape the linkedinUrl page
        // (we're already there in many cases) OR use the GraphQL query that
        // resolves vanity→fsd. The cheap + reliable path: a single
        // `DashProfiles` GraphQL call.
        const vanity = lead.linkedinUrl.split('/in/').pop()?.replace(/\/$/, '').split('?')[0] || '';
        if (!vanity) {
            return { success: false, error: 'Could not extract vanity from linkedinUrl' };
        }

        // Resolve fsdUrn via the lighter GraphQL endpoint (we still have a
        // page; ride its session). The endpoint we know works:
        //   /voyager/api/graphql?variables=(memberIdentity:<vanity>)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a
        // returns the fsd profile URN.
        const fsd = await resolveVanityToFsd(vanity, userId, page);
        if (!fsd) {
            return { success: false, error: `Could not resolve vanity ${vanity} to fsdUrn` };
        }

        // ---- Step 2: Call FullProfile-76 ----
        const r = await getProfileByFsd(userId, fsd, page);
        if (!r.ok) {
            return { success: false, error: `FullProfile fetch failed: ${(r as any).error || 'unknown'}` };
        }
        const p = r.data;
        output.name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || null;
        output.headline = p.headline;
        output.location = p.location;
        output.about = p.summary;

        // company / jobTitle: if FullProfile didn't carry them inline (it
        // typically doesn't), try parsing "<title> at <company>" out of the
        // headline as a fallback. Matches the DOM node's behavior.
        if (output.headline) {
            const m = output.headline.match(/^(.+?)\s+(?:at|@)\s+(.+?)$/i);
            if (m) {
                if (!output.jobTitle) output.jobTitle = cleanPersonField(m[1].trim(), output.name || '');
                if (!output.company) {
                    const cand = m[2].trim();
                    if (cand && !/[|·•]/.test(cand) && cand.length <= 60) output.company = cand;
                }
            }
        }

        // ---- Step 3: Persist Lead.row immediately (engine's
        // updateLeadEnrichment also writes this; doing it here too keeps
        // the row hot for IF_ELSE probes that check the same lead later in
        // the same campaign run).
        if (lead.id && p.memberId) {
            // Persist memberId (objectUrn) so check-connection can do cheap
            // /relationships/connections match without re-resolving.
            // (No Prisma column for memberId today; we'd need a migration.
            // Skip for now — connections endpoint matches on fsd/memberId
            // both, and we have fsd in the URL.)
        }
        if (output.location && lead.id) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: { location: output.location, enrichedAt: new Date() },
            }).catch((err: any) => console.log(`[PROFILE-VISIT-VOYAGER] location write failed: ${err.message}`));
        }

        // ---- Step 4: Connection degree check (cheap; uses cached 1st-deg list) ----
        // isFirstDegree returns true/false from the in-memory cache. Only tells
        // us 1st vs 2nd/3rd — the exact number still needs a DOM probe.
        const is1st = await isFirstDegree(userId, vanity, page).catch(() => false);
        output.connected = is1st;
        if (is1st) {
            // Set the binary "is 1st-degree" hint on Lead row. Don't write
            // connectionDegree as a specific 1/2/3 number — we don't know.
            await prisma.lead.update({
                where: { id: lead.id },
                data: { status: 'CONNECTED' },
            }).catch(() => {});
        }

        // ---- Step 5: 1st-degree contact info (DOM) — only when requested ----
        // For 1st-degree leads, the LinkedIn DOM exposes email + phone on a
        // "Contact info" modal that the API never returns. Open that modal
        // and read the values.
        if (enrichContact && is1st) {
            try {
                console.log('[PROFILE-VISIT-VOYAGER] 1st-degree + enrichContact: opening Contact info modal...');
                await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await wait(randomRange(8000, 12000));

                const contactBtn = page.locator('a:has-text("Contact info"), a#top-card-text-details-contact-info').first();
                if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await contactBtn.click();
                    await wait(2500);
                    const contactData = await page.evaluate(() => {
                        const data: any = { email: null, phone: null, connectedDate: null };
                        let container = document.body;
                        const h2s = Array.from(document.querySelectorAll('h2'));
                        const contactH2 = h2s.find((h: any) => h.innerText?.toLowerCase().includes('contact info') && h.closest('section'));
                        if (contactH2) {
                            container = contactH2.closest('section') || contactH2.parentElement?.parentElement || document.body;
                        }
                        const fullText = container.innerText;
                        const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                        if (emailMatch) data.email = emailMatch[0];
                        if (fullText.includes('Phone')) {
                            const afterPhone = fullText.split('Phone')[1]?.trim() || '';
                            data.phone = afterPhone.split('\n')[0]?.replace(/[a-zA-Z()]/g, '').trim();
                        }
                        if (fullText.includes('Connected since')) {
                            const afterConnected = fullText.split('Connected since')[1]?.trim() || '';
                            data.connectedDate = afterConnected.split('\n')[0]?.trim();
                        }
                        return data;
                    });
                    output.email = contactData.email;
                    output.phone = contactData.phone;
                    output.connectedDate = contactData.connectedDate;
                    await page.keyboard.press('Escape');
                    await wait(800);
                }
            } catch (e: any) {
                console.log(`[PROFILE-VISIT-VOYAGER] contact modal failed: ${e.message}`);
            }
        }

        // ---- Step 6: Recent posts (DOM) — only when requested ----
        if (enrichPosts) {
            try {
                console.log('[PROFILE-VISIT-VOYAGER] Scraping recent posts...');
                const activityUrl = lead.linkedinUrl.replace(/\/$/, '') + '/recent-activity/shares/';
                await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await wait(4000);
                for (let i = 0; i < 3; i++) {
                    await page.mouse.wheel(0, 800);
                    await wait(1200);
                }
                const postData = await page.evaluate(() => {
                    const wrapper = document.querySelector('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]');
                    if (!wrapper) return null;
                    const urn = wrapper.getAttribute('data-urn');
                    const content = (wrapper as HTMLElement).innerText.substring(0, 1000);
                    return { urn, url: `https://www.linkedin.com/feed/update/${urn}/`, content };
                });
                if (postData) {
                    output.latestPostUrl = postData.url;
                    // Prefer the login-free public post page: it returns the full,
                    // clean articleBody via JSON-LD (vs DOM innerText, which carries
                    // reaction/UI chrome and is truncated). Falls back to the
                    // scraped text if the guest fetch is walled/empty.
                    const { fetchPublicPostContent } = await import('../../services/public-post.service');
                    const pub = postData.urn ? await fetchPublicPostContent(postData.urn) : null;
                    output.latestPost = pub?.text || postData.content;
                    if (pub) console.log(`[PROFILE-VISIT-VOYAGER] post via public page (${pub.text.length} chars, ${pub.likes ?? '?'} likes)`);
                }
                // Navigate back to the profile so the engine's next step
                // (which may be send-message) doesn't start on the activity page.
                await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded' });
                await wait(2000);
            } catch (e: any) {
                console.log(`[PROFILE-VISIT-VOYAGER] posts scrape failed: ${e.message}`);
            }
        }

        console.log(`[PROFILE-VISIT-VOYAGER] Done for ${lead.firstName}: name=${output.name} company=${output.company} connected=${output.connected}`);
        return { success: true, output };
    } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
    }
};

/**
 * Resolve a public vanity (e.g. "shiva-singh-genai-llm") to its
 * fsd_profile URN. Uses the dashProfiles GraphQL endpoint which returns the
 * `*profile` URN ref. The actual profile entity is in `included[]`.
 *
 * If resolution fails (account not found, 404, etc.), returns null and
 * lets the caller fall back to a DOM scrape.
 */
async function resolveVanityToFsd(vanity: string, userId: string, page: any): Promise<string | null> {
    try {
        const url = `https://www.linkedin.com/voyager/api/graphql?variables=(memberIdentity:${encodeURIComponent(vanity)})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`;
        // We import dynamically to avoid a hard dep cycle with the service
        const { voyagerFetch } = await import('../../services/voyager-api.service');
        const r = await voyagerFetch<any>(userId, url, { page, skipRateLimit: true });
        if (!r.ok) {
            console.log(`[PROFILE-VISIT-VOYAGER] vanity resolve failed: status=${(r as any).status} err=${(r as any).error}`);
            return null;
        }
        const data = (r.data as any)?.data || {};
        const included = Array.isArray((r.data as any)?.included) ? (r.data as any).included : [];
        // The response is `data["*profile"]` = "urn:li:fsd_profile:<id>" and
        // the matching entity is in included[]. Sometimes the response wraps
        // the URN in `included[0].entityUrn` directly.
        const profileUrn = data['*profile'] || data.profile;
        if (profileUrn && profileUrn.startsWith('urn:li:fsd_profile:')) return profileUrn;
        const found = included.find((e: any) =>
            e.entityUrn?.startsWith('urn:li:fsd_profile:') ||
            e['*entityUrn']?.startsWith('urn:li:fsd_profile:')
        );
        if (found) {
            return found.entityUrn || found['*entityUrn'];
        }
        return null;
    } catch {
        return null;
    }
}
