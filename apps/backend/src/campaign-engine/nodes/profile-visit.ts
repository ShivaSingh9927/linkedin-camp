import { NodeHandler, NodeResult, ProfileVisitOutput } from '../types';
import { detectConnectionState } from '../connection-state';
import { scrollProfile, extractTopCard, extractAbout, extractExperience, extractExperienceList, extractEducationList, scrapeRecentPosts } from '../scrape/profile-scrape';
import { extractEmailFromText } from '../scrape/email-from-text';
import { cleanPersonField } from '../scrape/sanitize';
import { prisma } from '@repo/db';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const profileVisit: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead } = ctx;
    const enrichPosts = (config as any)?.enrichPosts === true;

    const output: ProfileVisitOutput = {
        name: null,
        firstName: null,
        lastName: null,
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
        console.log(`[PROFILE-VISIT] Opening profile: ${lead.linkedinUrl}`);

        await page.goto(lead.linkedinUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await wait(randomRange(12000, 18000));

        const url = page.url();
        if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
            return { success: false, error: `Session invalid. Redirected to: ${url}` };
        }

        // --- SCROLL AGGRESSIVELY (shared with self-profile enrichment) ---
        console.log('[PROFILE-VISIT] Aggressive scrolling...');
        await scrollProfile(page);

        // --- CHECK CONNECTED ---
        // Compose-link presence is the only reliable "can I DM right now"
        // signal in LinkedIn's new design system. The old <button>Message
        // check returned false for everyone.
        try {
            const state = await detectConnectionState(page, lead.linkedinUrl);
            output.connected = state.isDmable;
            // Persist connectionDegree onto the Lead row when we have a
            // confident reading. Only write non-null degree — a probe that
            // failed to read the badge shouldn't wipe out a previously-known
            // value (e.g. one captured at extension scrape time).
            if (state.connectionDegree != null) {
                output.connectionDegree = state.connectionDegree;
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { connectionDegree: state.connectionDegree },
                }).catch((err: any) => console.log(`[PROFILE-VISIT] Lead.connectionDegree write failed: ${err.message}`));
            }
        } catch {}

        // --- EXTRACT TOP CARD (shared extractor) ---
        try {
            const topCardData = await extractTopCard(page);
            output.name = topCardData.name;
            // Split the display name into first/last for the email-finder (DOM
            // has no separate fields; first token = first name, rest = last).
            if (output.name) {
                const parts = output.name.trim().split(/\s+/);
                output.firstName = parts[0] || null;
                output.lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
            }
            output.headline = topCardData.headline;
            output.location = topCardData.location;
            console.log(`[PROFILE-VISIT] Name: ${output.name}, Headline: ${output.headline}`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] Top card error: ${e?.message}`);
        }

        // --- EXTRACT ABOUT (shared extractor) ---
        try {
            const aboutText = await extractAbout(page);
            output.about = aboutText;
            console.log(`[PROFILE-VISIT] About: ${aboutText?.substring(0, 50)}...`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] About error: ${e?.message}`);
        }

        // --- EXTRACT EXPERIENCE (shared extractor) ---
        try {
            const expData = await extractExperience(page);

            output.company = expData.company;
            // Reject a junk jobTitle (degree subtitle, the person's own name, etc.).
            output.jobTitle = cleanPersonField(expData.jobTitle, output.name);
            output.companyUrl = expData.companyUrl;

            // Last-resort: parse "<title> at <company>" out of the headline so
            // profiles whose experience scrape failed still get usable values.
            // Only trust a clean headline (extractTopCard already sanitizes it).
            if ((!output.company || !output.jobTitle) && output.headline) {
                const m = output.headline.match(/^(.+?)\s+(?:at|@)\s+(.+?)$/i);
                if (m) {
                    if (!output.jobTitle) output.jobTitle = cleanPersonField(m[1].trim(), output.name);
                    // Only trust a headline-derived company when it's a single clean
                    // token — never a multi-segment banner ("Bynd | … | We're Hiring").
                    // A real company comes from the logo alt in extractExperience;
                    // this is just a fallback for "<title> at <Company>" headlines.
                    if (!output.company) {
                        const cand = m[2].trim();
                        if (cand && !/[|·•]/.test(cand) && cand.length <= 60) output.company = cand;
                    }
                    console.log(`[PROFILE-VISIT] Filled company/jobTitle from headline.`);
                }
            }

            console.log(`[PROFILE-VISIT] Company: ${output.company}, Job: ${output.jobTitle}`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] Experience error: ${e?.message}`);
        }

        // --- EXTRACT FULL EXPERIENCE / EDUCATION LISTS (best-effort) ---
        try {
            output.experience = (await extractExperienceList(page)) as any;
            output.education = (await extractEducationList(page)) as any;
            console.log(`[PROFILE-VISIT] Experience entries: ${output.experience.length}, Education: ${output.education.length}`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] Experience/education list error: ${e?.message}`);
        }

        // --- EXTRACT CONTACT INFO (exact from testscript) ---
        try {
            console.log('[PROFILE-VISIT] Opening Contact Info modal...');
            const contactBtn = page.locator('a:has-text("Contact info"), a#top-card-text-details-contact-info').first();
            
            if (await contactBtn.isVisible()) {
                await contactBtn.click();
                await wait(2000);
                
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
                console.log(`[PROFILE-VISIT] Email: ${output.email}, Phone: ${output.phone}`);
                
                await page.keyboard.press('Escape');
                await wait(1000);
            } else {
                console.log('[PROFILE-VISIT] Contact info button not visible');
            }
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] Contact error: ${e?.message}`);
        }

        // --- SELF-PUBLISHED EMAIL in headline/about (all degrees) ---
        // The contact modal above is 1st-degree-only. For everyone else, people
        // often put a contact email in their bio — scan the text we already have.
        if (!output.email) {
            const bioEmail = extractEmailFromText(output.headline, output.about);
            if (bioEmail) {
                output.email = bioEmail;
                console.log(`[PROFILE-VISIT] email from bio text: ${bioEmail}`);
            }
        }

        // --- EXTRACT LATEST POST (if enrichPosts is set) ---
        if (enrichPosts && lead.linkedinUrl) {
            try {
                console.log('[PROFILE-VISIT] Scraping latest post...');
                const posts = await scrapeRecentPosts(page, lead.linkedinUrl, 1);
                if (posts.length > 0) {
                    output.latestPost = posts[0].content.substring(0, 1000);
                    output.latestPostUrl = posts[0].url;
                    console.log(`[PROFILE-VISIT] Latest post: ${output.latestPost?.substring(0, 60)}...`);
                } else {
                    console.log('[PROFILE-VISIT] No posts found.');
                }
            } catch (e: any) {
                console.log(`[PROFILE-VISIT] Post scrape error: ${e?.message}`);
            }
        }

        // Persistence happens centrally in engine.ts via updateLeadEnrichment
        // once this handler returns. Doing it here too caused a second write
        // race that re-corrupted firstName ("Shiva Singh") on top of the
        // engine's canonical split.

        console.log(`[PROFILE-VISIT] Done. Name: ${output.name}, Company: ${output.company}, Connected: ${output.connected}`);
        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};