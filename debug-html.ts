/**
 * debug-html.ts - Extract page HTML after Message button click
 */
import { chromium } from 'playwright-extra';
import { prisma } from '@repo/db';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'shivasingh9927@gmail.com' } });
    if (!user) { process.exit(1); }

    const raw = JSON.parse(user.linkedinCookie!);
    const cookies = raw.map((c: any) => ({
        ...c,
        expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'unspecified' ? 'Lax' : c.sameSite),
    }));

    let userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
    try { userAgent = JSON.parse(user.linkedinFingerprint as string).userAgent; } catch {}

    let localStorage: Record<string, string> = {};
    try { localStorage = JSON.parse(user.linkedinLocalStorage as string); } catch {}

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent, viewport: null, locale: 'en-IN', timezoneId: 'Asia/Kolkata',
        proxy: { server: 'http://82.41.252.111:46222', username: 'xBVyYdUpx84nWx7', password: 'dwwTxtvv5a10RXn' },
    });

    await context.addCookies(cookies);
    if (Object.keys(localStorage).length > 0) {
        await context.addInitScript((data: string) => {
            const parsed = JSON.parse(data);
            for (const [k, v] of Object.entries(parsed)) window.localStorage.setItem(k, v as string);
        }, JSON.stringify(localStorage));
    }

    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(30000);

    try {
        // Warmup
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(5000);
        console.log('Warmup URL:', page.url());

        // Profile
        await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(randomRange(10000, 12000));

        // Click Message
        const msgBtn = page.locator('button:has-text("Message")').first();
        if (await msgBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await msgBtn.click({ force: true });
            console.log('Message button clicked');
        }

        await wait(randomRange(10000, 15000));
        console.log('URL after wait:', page.url());

        // Check ALL visible elements on the page
        const pageState = await page.evaluate(() => {
            const result: any = {
                url: window.location.href,
                modals: [],
                overlays: [],
                forms: [],
                editables: [],
                buttons: [],
                iframes: [],
            };

            // Check for modals
            document.querySelectorAll('.artdeco-modal, [role="dialog"], .modal, [class*="modal"], [class*="overlay"]').forEach(el => {
                result.modals.push({
                    tag: el.tagName,
                    class: el.className?.substring?.(0, 100),
                    visible: (el as HTMLElement).offsetParent !== null,
                    text: el.textContent?.substring(0, 200),
                });
            });

            // Check for contenteditable
            document.querySelectorAll('[contenteditable="true"]').forEach(el => {
                result.editables.push({
                    tag: el.tagName,
                    class: el.className?.substring?.(0, 100),
                    id: el.id,
                });
            });

            // Check for forms
            document.querySelectorAll('form, [class*="msg-form"], [class*="compose"]').forEach(el => {
                result.forms.push({
                    tag: el.tagName,
                    class: el.className?.substring?.(0, 100),
                });
            });

            // Check for Message-related buttons
            document.querySelectorAll('button, a').forEach(el => {
                const text = el.textContent?.trim() || '';
                const ariaLabel = el.getAttribute('aria-label') || '';
                if (text.toLowerCase().includes('message') || ariaLabel.toLowerCase().includes('message')) {
                    result.buttons.push({
                        tag: el.tagName,
                        text: text.substring(0, 80),
                        ariaLabel: ariaLabel.substring(0, 80),
                        class: el.className?.substring?.(0, 60),
                        visible: (el as HTMLElement).offsetParent !== null,
                    });
                }
            });

            // Check for iframes
            document.querySelectorAll('iframe').forEach(el => {
                result.iframes.push({
                    src: el.src?.substring(0, 100),
                    id: el.id,
                    class: el.className?.substring?.(0, 60),
                });
            });

            // Get any alert/notification text
            const alerts = document.querySelectorAll('[role="alert"], .alert, [class*="toast"], [class*="notification"]');
            result.alerts = Array.from(alerts).map(el => el.textContent?.substring(0, 200));

            return result;
        });

        console.log('\n=== PAGE STATE ===');
        console.log(JSON.stringify(pageState, null, 2));

        // Also dump the body HTML class and any top-level structure
        const bodyInfo = await page.evaluate(() => {
            const body = document.body;
            const topLevelChildren = Array.from(body.children).map(c => ({
                tag: c.tagName,
                id: c.id,
                class: c.className?.substring?.(0, 80),
            }));
            return { bodyClass: body.className, children: topLevelChildren };
        });
        console.log('\n=== BODY STRUCTURE ===');
        console.log(JSON.stringify(bodyInfo, null, 2));

    } catch (err: any) {
        console.error('ERROR:', err.message);
    }

    await browser.close();
    await prisma.$disconnect();
}

main().catch(console.error);
