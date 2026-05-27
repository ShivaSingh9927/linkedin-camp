import { NodeHandler, NodeResult, ProfileVisitOutput } from '../types';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const profileVisit: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead } = ctx;

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

        // --- SCROLL AGGRESSIVELY (exact copy from working testscript) ---
        console.log('[PROFILE-VISIT] Aggressive scrolling...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await wait(3000);
        
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await wait(1500);
        }
        
        await page.evaluate(() => window.scrollTo(0, 0));
        await wait(1000);

        // Ensure Experience loaded
        for (let i = 0; i < 6; i++) {
            const found = await page.evaluate(() => {
                const hs = document.querySelectorAll('h2');
                return Array.from(hs).some((h: any) => h.innerText?.trim()?.toLowerCase() === 'experience');
            });
            if (found) break;
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await wait(1200 * (i + 1));
        }
        
        // Scroll to Experience section
        await page.evaluate(() => {
            const h2s = document.querySelectorAll('h2');
            const expH2 = Array.from(h2s).find((h: any) => h.innerText?.trim()?.toLowerCase() === 'experience');
            if (expH2) expH2.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await wait(2000);

        // Final scroll
        await page.evaluate(() => {
            for (let i = 0; i < 3; i++) window.scrollBy(0, 800);
        });
        await wait(3000);

        // --- CHECK CONNECTED ---
        try {
            output.connected = await page.isVisible('button:has-text("Message")');
        } catch {}

        // --- EXTRACT TOP CARD (exact from testscript) ---
        try {
            const topCardData = await page.evaluate(() => {
                const data: any = { name: null, headline: null, location: null };
                
                const contactLinks = Array.from(document.querySelectorAll('a')).filter((a: any) => 
                    a.innerText?.toLowerCase().includes('contact info') || (a.id && a.id.includes('contact-info'))
                );
                
                if (contactLinks.length > 0) {
                    const section = contactLinks[0].closest('section');
                    if (section) {
                        const rawText = section.innerText.split('\n')
                            .map((t: string) => t.trim())
                            .filter((t: string) => t.length > 0 && !t.includes('connections') && !t.includes('Message'));
                        
                        const uniqueDetails = [...new Set(rawText)];
                        
                        if (uniqueDetails.length > 0) {
                            data.name = uniqueDetails[0];
                            ['He/Him', 'She/Her', 'They/Them'].forEach((p: string) => {
                                if (data.name?.endsWith(p)) data.name = data.name.replace(p, '').trim();
                            });
                        }
                        
                        const potentialHeadlines = uniqueDetails.filter((t: string) => 
                            t.length > 15 && t !== data.name && !t.includes(',')
                        );
                        if (potentialHeadlines.length > 0) data.headline = potentialHeadlines[0];
                        
                        data.location = uniqueDetails.find((t: string) => 
                            t.includes(',') && !t.includes('Mutual')
                        );
                    }
                }
                return data;
            });
            
            output.name = topCardData.name;
            output.headline = topCardData.headline;
            output.location = topCardData.location;
            console.log(`[PROFILE-VISIT] Name: ${output.name}, Headline: ${output.headline}`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] Top card error: ${e?.message}`);
        }

        // --- EXTRACT ABOUT (exact from testscript) ---
        try {
            const aboutText = await page.evaluate(() => {
                const h2s = Array.from(document.querySelectorAll('h2'));
                const aboutH2 = h2s.find((h: any) => h.innerText?.trim()?.toLowerCase() === 'about');
                if (!aboutH2) return null;

                const section = aboutH2.closest('section');
                if (!section) return null;

                const textBox = section.querySelector('.display-flex.ph5.pv3, [data-testid="expandable-text-box"]') || section;
                return (textBox as HTMLElement).innerText?.replace('About\n', '').trim();
            });
            output.about = aboutText;
            console.log(`[PROFILE-VISIT] About: ${aboutText?.substring(0, 50)}...`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] About error: ${e?.message}`);
        }

        // --- EXTRACT EXPERIENCE ---
        // LinkedIn renders the section header several ways and frequently drops
        // the `<img alt="X logo">` attribute when companies have no logo. The
        // previous scrape required both an exact-match h2 and that alt text,
        // so most profiles came back with company=null/jobTitle=null.
        try {
            const expData = await page.evaluate(() => {
                const data: any = { company: null, jobTitle: null, companyUrl: null };

                // Find the Experience section header tolerantly: any heading or
                // anchor target whose visible text contains "experience".
                const headers = Array.from(document.querySelectorAll('h2, div[role="heading"]'));
                const header = headers.find((h: any) => {
                    const txt = (h.innerText || h.textContent || '').trim().toLowerCase();
                    return txt === 'experience' || txt.startsWith('experience\n') || txt === 'experience ';
                }) || document.querySelector('#experience');

                const section: Element | null = header
                    ? ((header as HTMLElement).closest('section') || (header.parentElement as Element))
                    : null;
                if (!section) return data;

                // Company URL is reliable when present.
                const companyLink = section.querySelector('a[href*="/company/"]');
                if (companyLink) {
                    data.companyUrl = (companyLink as HTMLAnchorElement).href?.split('?')[0] || null;
                }

                // First experience entry. LinkedIn keeps changing the wrapper
                // (`ul > li`, `.pvs-list__paged-list-item`, `.artdeco-list__item`).
                const firstJob = section.querySelector(
                    'ul > li, .pvs-list__paged-list-item, .artdeco-list__item, [data-view-name="profile-component-entity"]'
                );
                if (!firstJob) return data;

                // Inside the first card, LinkedIn marks each text run with an
                // aria-hidden span that's the actual visible value. Collect them
                // in order — the first is the role/title, the second is the
                // "Company · Employment Type" line.
                const spans = Array.from(firstJob.querySelectorAll('span[aria-hidden="true"]'))
                    .map((s: any) => (s.innerText || s.textContent || '').trim())
                    .filter((t: string) => t.length > 0);

                if (spans.length > 0) data.jobTitle = spans[0];

                if (spans.length > 1) {
                    // "Acme Inc · Full-time"  →  "Acme Inc"
                    data.company = spans[1].split('·')[0].trim() || null;
                }

                // Logo alt as final fallback for company name.
                if (!data.company) {
                    const logoImg = firstJob.querySelector('img[alt]') || section.querySelector('a[href*="/company/"] img[alt]');
                    const alt = logoImg?.getAttribute('alt')?.replace(/\s*logo\s*$/i, '').trim();
                    if (alt && alt.length > 1) data.company = alt;
                }

                return data;
            });

            output.company = expData.company;
            output.jobTitle = expData.jobTitle;
            output.companyUrl = expData.companyUrl;

            // Last-resort: parse "<title> at <company>" out of the headline so
            // profiles whose experience scrape failed still get usable values.
            if ((!output.company || !output.jobTitle) && output.headline) {
                const m = output.headline.match(/^(.+?)\s+(?:at|@)\s+(.+?)$/i);
                if (m) {
                    if (!output.jobTitle) output.jobTitle = m[1].trim();
                    if (!output.company)  output.company  = m[2].trim();
                    console.log(`[PROFILE-VISIT] Filled company/jobTitle from headline.`);
                }
            }

            console.log(`[PROFILE-VISIT] Company: ${output.company}, Job: ${output.jobTitle}`);
        } catch (e: any) {
            console.log(`[PROFILE-VISIT] Experience error: ${e?.message}`);
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