/**
 * debug-message-flow.ts
 * Debug script to understand why the message textbox isn't found
 */
import { chromium } from 'playwright-extra';
import { prisma } from '@repo/db';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'shivasingh9927@gmail.com' } });
    if (!user) { console.error('User not found'); process.exit(1); }

    const raw = JSON.parse(user.linkedinCookie!);
    const cookies = raw.map((c: any) => ({
        ...c,
        expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'unspecified' ? 'Lax' : c.sameSite),
    }));

    let userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
    try {
        const fp = JSON.parse(user.linkedinFingerprint as string);
        userAgent = fp.userAgent;
    } catch {}

    let localStorage: Record<string, string> = {};
    try {
        localStorage = JSON.parse(user.linkedinLocalStorage as string);
    } catch {}

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
    });

    const context = await browser.newContext({
        userAgent,
        viewport: null,
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: {
            server: 'http://82.41.252.111:46222',
            username: 'xBVyYdUpx84nWx7',
            password: 'dwwTxtvv5a10RXn',
        },
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
        // Step 1: Warmup
        console.log('[1] Warmup - visiting feed...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(5000);
        console.log('  URL:', page.url());
        await page.screenshot({ path: '/app/sessions/debug_01_feed.png' });

        // Step 2: Go to profile
        console.log('[2] Visiting profile...');
        await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(randomRange(12000, 15000));
        console.log('  URL:', page.url());
        await page.screenshot({ path: '/app/sessions/debug_02_profile.png' });

        // Step 3: Check for compose URL
        console.log('[3] Looking for compose URL...');
        const composeUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href*="/messaging/compose/?profileUrn"]');
            return link ? (link as HTMLAnchorElement).href : null;
        });
        console.log('  Compose URL:', composeUrl);

        // Step 4: Check for Message button
        console.log('[4] Looking for Message button...');
        const msgBtnSelectors = [
            'button:has-text("Message")',
            'a:has-text("Message")',
            '.pvs-profile-actions button:has-text("Message")',
            'button[aria-label*="essage"]',
        ];
        for (const sel of msgBtnSelectors) {
            const btn = page.locator(sel).first();
            const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`  ${sel}: ${visible ? 'VISIBLE' : 'not found'}`);
        }

        // Step 5: Click Message button
        console.log('[5] Clicking Message button...');
        const msgBtn = page.locator('button:has-text("Message")').first();
        if (await msgBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await msgBtn.evaluate((node: any) => node.scrollIntoView({ block: 'center' }));
            await wait(1000);
            await msgBtn.click({ force: true });
            console.log('  Clicked!');
        } else {
            // Try More menu
            console.log('  Message not visible, trying More menu...');
            const moreBtn = page.locator('button:has(span:text-is("More"))').first();
            if (await moreBtn.isVisible()) {
                await moreBtn.click({ force: true });
                await wait(2000);
                const moreMsgBtn = page.locator('[role="menuitem"]:has-text("Message")').first();
                if (await moreMsgBtn.isVisible()) {
                    await moreMsgBtn.click({ force: true });
                    console.log('  Clicked via More menu!');
                }
            }
        }

        // Step 6: Wait and screenshot
        console.log('[6] Waiting 5s after click...');
        await wait(5000);
        console.log('  URL:', page.url());
        await page.screenshot({ path: '/app/sessions/debug_03_after_msg_click.png' });

        // Step 7: Check what's on the page
        console.log('[7] Checking page state...');
        const textboxSelectors = [
            'div.msg-form__contenteditable[contenteditable="true"]',
            '[role="textbox"]',
            '.msg-form__contenteditable',
            '.msg-form__textarea',
            'div[contenteditable="true"]',
            '.msg-conversation-wrapper',
            '.msg-overlay',
            '.msg-overlay-conversation-bubble',
        ];
        for (const sel of textboxSelectors) {
            const el = page.locator(sel).first();
            const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`  ${sel}: ${visible ? 'VISIBLE' : 'not found'}`);
        }

        // Step 8: Wait more and retry
        console.log('[8] Waiting 10 more seconds...');
        await wait(10000);
        await page.screenshot({ path: '/app/sessions/debug_04_after_wait.png' });
        
        for (const sel of textboxSelectors) {
            const el = page.locator(sel).first();
            const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
            if (visible) console.log(`  FOUND: ${sel}`);
        }

        // Step 9: Check current page HTML for messaging elements
        console.log('[9] Checking page HTML for messaging clues...');
        const htmlSnippet = await page.evaluate(() => {
            const body = document.body.innerHTML;
            // Look for messaging-related elements
            const patterns = ['msg-form', 'msg-overlay', 'messaging', 'compose', 'contenteditable'];
            const found: string[] = [];
            for (const p of patterns) {
                if (body.includes(p)) found.push(p);
            }
            return { foundPatterns: found, url: window.location.href, title: document.title };
        });
        console.log('  Found patterns:', JSON.stringify(htmlSnippet));

        // Step 10: If we're on messaging page, check there
        if (page.url().includes('/messaging')) {
            console.log('[10] On messaging page, waiting for load...');
            await wait(10000);
            await page.screenshot({ path: '/app/sessions/debug_05_messaging.png' });
            
            const msgPageSelectors = [
                'div.msg-form__contenteditable[contenteditable="true"]',
                '[role="textbox"]',
                '.msg-conversation-listitem',
                '.msg-s-message-list',
            ];
            for (const sel of msgPageSelectors) {
                const el = page.locator(sel).first();
                const visible = await el.isVisible({ timeout: 5000 }).catch(() => false);
                console.log(`  ${sel}: ${visible ? 'VISIBLE' : 'not found'}`);
            }
        }

    } catch (err: any) {
        console.error('ERROR:', err.message);
    }

    await wait(2000);
    await browser.close();
    await prisma.$disconnect();
    console.log('\nDone. Check debug_*.png screenshots in /app/sessions/');
}

main().catch(console.error);
