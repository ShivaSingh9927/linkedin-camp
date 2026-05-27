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

        // --- EXTRACT EXPERIENCE (exact from testscript) ---
        try {
            const expData = await page.evaluate(() => {
                const data: any = { company: null, jobTitle: null, companyUrl: null };
                
                const h2s = Array.from(document.querySelectorAll('h2'));
                const header = h2s.find((h: any) => h.innerText?.trim()?.toLowerCase() === 'experience');
                if (!header) return data;

                const section = header.closest('section');
                if (!section) return data;

                const logoImg = section.querySelector('a[href*="/company/"] img');
                data.company = logoImg?.getAttribute('alt')?.replace(/logo$/i, '').trim() || null;

                const companyLink = section.querySelector('a[href*="/company/"]');
                data.companyUrl = companyLink ? (companyLink as HTMLAnchorElement).href?.split('?')[0] : null;

                const firstJob = section.querySelector('ul > li') || section.querySelector('.pvs-list__paged-list-item');
                if (!firstJob) return data;

                const lines = (firstJob as HTMLElement).innerText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
                data.jobTitle = lines[0] || null;

                return data;
            });
            
            output.company = expData.company;
            output.jobTitle = expData.jobTitle;
            output.companyUrl = expData.companyUrl;
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