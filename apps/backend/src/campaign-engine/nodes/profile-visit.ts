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
            // Try h1 with common LinkedIn selectors
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
            // Fallback: extract from page text
            if (!output.name) {
                output.name = await page.evaluate(() => {
                    const h1 = document.querySelector('h1');
                    return h1 ? h1.textContent?.trim() || null : null;
                });
            }
            // Final fallback: use lead's firstName from DB
            if (!output.name && lead.firstName) {
                output.name = lead.firstName;
            }
        } catch {}

        // --- Update lead in DB with extracted name ---
        if (output.name && output.name !== lead.firstName) {
            try {
                const nameParts = output.name.split(' ').filter(n => n.length > 0);
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || null;
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { firstName, lastName },
                });
                console.log(`[PROFILE-VISIT] Updated lead with name: ${firstName} ${lastName || ''}`);
            } catch (err) {
                console.log(`[PROFILE-VISIT] Could not update lead name: ${err}`);
            }
        }

        // --- Check connection degree ---
        try {
            const isConnected = await page.isVisible('button:has-text("Message")');
            output.connected = isConnected;
        } catch {}

        // --- Extract About ---
        try {
            console.log('[PROFILE-VISIT] Extracting About...');
            await page.mouse.wheel(0, 800);
            await wait(1500);

            const aboutSection = page.locator('section:has(div[id="about"]), section:has(h2:has-text("About"))').first();
            if (await aboutSection.isVisible({ timeout: 5000 })) {
                const moreBtn = aboutSection.locator('button[data-testid="expandable-text-button"]').first();
                if (await moreBtn.isVisible({ timeout: 3000 })) {
                    await moreBtn.evaluate((el: any) => el.click());
                    await wait(1000);
                }
                const aboutBox = aboutSection.locator('[data-testid="expandable-text-box"]').first();
                if (await aboutBox.isVisible({ timeout: 3000 })) {
                    output.about = await aboutBox.innerText();
                }
            }
        } catch {}

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

        console.log(`[PROFILE-VISIT] Done. Name: ${output.name}, Company: ${output.company}, Connected: ${output.connected}`);
        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
