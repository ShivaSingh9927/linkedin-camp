import { NodeHandler, NodeResult, ProfileVisitOutput } from '../types';
import { prisma } from '@repo/db';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const profileVisit: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead } = ctx;

    const output: ProfileVisitOutput = {
        name: null,
        company: null,
        jobTitle: null,
        companyUrl: null,
        about: null,
        email: null,
        phone: null,
        connected: false,
    };

    try {
        console.log(`[PROFILE-VISIT] Opening profile: ${lead.linkedinUrl}`);

        await page.goto(lead.linkedinUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await wait(randomRange(12000, 18000));

        await page.mouse.wheel(0, 600);
        await wait(2000);

        // Session validation
        const url = page.url();
        if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
            return { success: false, error: `Session invalid. Redirected to: ${url}` };
        }

        // --- Extract name ---
        try {
            const selectors = [
                'h1.text-heading-xlarge',
                'h1.break-words',
                '.pv-text-details__left-panel h1',
                'h1',
            ];
            for (const sel of selectors) {
                const nameEl = page.locator(sel).first();
                if (await nameEl.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const text = (await nameEl.innerText()).trim();
                    if (text && text.length > 1 && text.length < 100) {
                        output.name = text;
                        break;
                    }
                }
            }
            if (!output.name) {
                output.name = await page.evaluate(() => {
                    const h1 = document.querySelector('h1');
                    return h1 ? h1.textContent?.trim() || null : null;
                });
            }
            if (!output.name && lead.firstName) {
                output.name = lead.firstName;
            }
        } catch {}

        // --- Check connection degree ---
        try {
            output.connected = await page.isVisible('button:has-text("Message")');
        } catch {}

        // --- Extract About ---
        try {
            console.log('[PROFILE-VISIT] Extracting About...');
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await wait(2000);

            const aboutSection = page.locator('section:has(span:text("About"))').first();
            const isAboutVisible = await aboutSection.isVisible({ timeout: 5000 }).catch(() => false);
            console.log('[PROFILE-VISIT] About section visible:', isAboutVisible);
            
            if (isAboutVisible) {
                // Try multiple ways to get About text
                const aboutBox = aboutSection.locator('[data-testid="expandable-text-box"]').first();
                const isBoxVisible = await aboutBox.isVisible({ timeout: 3000 }).catch(() => false);
                console.log('[PROFILE-VISIT] About box visible:', isBoxVisible);
                
                if (isBoxVisible) {
                    output.about = await aboutBox.innerText();
                    console.log('[PROFILE-VISIT] About extracted (box):', output.about?.substring(0, 50) + '...');
                } else {
                    // Try getting text directly from the section
                    const sectionText = await aboutSection.innerText().catch(() => '');
                    console.log('[PROFILE-VISIT] Section text length:', sectionText.length);
                    if (sectionText && sectionText.length > 10) {
                        // Extract just the About portion (after "About" heading)
                        const lines = sectionText.split('\n').filter(l => l.trim());
                        const aboutIndex = lines.findIndex(l => l.toLowerCase().includes('about'));
                        if (aboutIndex >= 0 && aboutIndex + 1 < lines.length) {
                            output.about = lines.slice(aboutIndex + 1).join('\n').trim();
                            console.log('[PROFILE-VISIT] About extracted (innerText):', output.about?.substring(0, 50) + '...');
                        }
                    }
                }
            }
        } catch (e: any) {
            console.log('[PROFILE-VISIT] About extraction error:', e?.message);
        }

        // --- Extract Experience (company, job title, company URL) ---
        try {
            console.log('[PROFILE-VISIT] Extracting Experience...');
            for (let i = 0; i < 4; i++) {
                await page.keyboard.press('PageDown');
                await wait(600);
            }

            const extracted = await page.evaluate(() => {
                const textNodes = Array.from(document.querySelectorAll('span[aria-hidden="true"], h2 span, h2'));
                const expNode = textNodes.find(node => (node as any).innerText?.trim() === 'Experience');
                if (!expNode) return null;
                const expSection = expNode.closest('section');
                if (!expSection) return null;

                const firstLogoImg = expSection.querySelector('a[href*="/company/"] img');
                const companyName = firstLogoImg?.getAttribute('alt')?.replace(/logo$/i, '').trim() || 'Unknown';
                const firstCompanyLink = expSection.querySelector('a[href*="/company/"]');
                const companyUrl = firstCompanyLink ? (firstCompanyLink as HTMLAnchorElement).href.split('?')[0] : null;

                const firstJobItem = expSection.querySelector('ul > li') || expSection.querySelector('.pvs-list__paged-list-item');
                if (!firstJobItem) return { companyName, companyUrl, jobTitle: 'Unknown' };

                const rawLines = (firstJobItem as HTMLElement).innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const details: string[] = [];
                for (let i = 0; i < rawLines.length; i++) {
                    if (i === 0 || rawLines[i] !== rawLines[i - 1]) details.push(rawLines[i]);
                }

                let jobTitle = 'Unknown';
                if (details.length > 0) {
                    if (companyName !== 'Unknown' && details[0].toLowerCase().includes(companyName.toLowerCase())) {
                        jobTitle = details.length > 3 ? details[3] : details[0];
                    } else {
                        jobTitle = details[0];
                    }
                }
                return { companyName, jobTitle, companyUrl };
            });

            if (extracted) {
                if (extracted.companyName && extracted.companyName !== 'Unknown') output.company = extracted.companyName;
                if (extracted.jobTitle && extracted.jobTitle !== 'Unknown') output.jobTitle = extracted.jobTitle;
                output.companyUrl = extracted.companyUrl;
            }
        } catch {}

        // --- Extract Contact Info (only if connected) ---
        if (output.connected) {
            try {
                console.log('[PROFILE-VISIT] Extracting Contact Info (1st degree)...');
                const contactBtn = page.locator('a[href*="/overlay/contact-info/"]').first();
                if (await contactBtn.isVisible({ timeout: 5000 })) {
                    await contactBtn.evaluate((el: any) => el.click());
                    await wait(2000);

                    const contactData = await page.evaluate(() => {
                        const data: any = { email: null, phone: null };
                        const labels = Array.from(document.querySelectorAll('div[data-component-type="LazyColumn"] p:first-child'));
                        for (const label of labels) {
                            const labelText = (label as HTMLElement).innerText?.trim();
                            const valueNode = label.nextElementSibling;
                            if (valueNode) {
                                if (labelText === 'Email') {
                                    data.email = (valueNode as HTMLElement).innerText?.trim();
                                } else if (labelText === 'Phone') {
                                    const firstSpan = valueNode.querySelector('span');
                                    data.phone = firstSpan ? (firstSpan as HTMLElement).innerText?.trim() : (valueNode as HTMLElement).innerText?.trim();
                                }
                            }
                        }
                        return data;
                    });

                    if (contactData.email) output.email = contactData.email;
                    if (contactData.phone) output.phone = contactData.phone;

                    await page.keyboard.press('Escape');
                    await wait(1000);
                }
            } catch {}
        }

        // --- Update lead in DB with extracted data ---
        if (output.name || output.company || output.jobTitle || output.about) {
            try {
                const nameParts = (output.name || '').split(' ').filter(n => n.length > 0);
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || null;
                
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { 
                        firstName, 
                        lastName,
                        company: output.company || undefined,
                        jobTitle: output.jobTitle || undefined,
                        aboutInfo: output.about || undefined,
                    },
                });
                console.log(`[PROFILE-VISIT] Updated lead: ${firstName} ${lastName || ''}, Company: ${output.company}, Job: ${output.jobTitle}, About: ${output.about ? 'Yes' : 'No'}`);
            } catch (err) {
                console.log(`[PROFILE-VISIT] Could not update lead: ${err}`);
            }
        }

        console.log(`[PROFILE-VISIT] Done. Name: ${output.name}, Company: ${output.company}, Job: ${output.jobTitle}, Connected: ${output.connected}`);
        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};