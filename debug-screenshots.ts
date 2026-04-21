/**
 * debug-screenshots.ts - Capture screenshots at key points
 */
import { chromium } from 'playwright-extra';
import { prisma } from '@repo/db';
import * as fs from 'fs';
import * as path from 'path';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'shivasingh9927@gmail.com' } });
    if (!user) { process.exit(1); }

    // Load from FILES (fresh session)
    const sessionDir = `/app/sessions/${user.id}`;
    let cookies: any[] = [];
    let userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
    let localStorage: Record<string, string> = {};

    try { cookies = JSON.parse(fs.readFileSync(path.join(sessionDir, 'cookies.json'), 'utf-8')); } catch {}
    try { userAgent = JSON.parse(fs.readFileSync(path.join(sessionDir, 'fingerprint.json'), 'utf-8')).userAgent; } catch {}

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent, viewport: null, locale: 'en-IN', timezoneId: 'Asia/Kolkata',
        proxy: { server: 'http://82.41.252.111:46222', username: 'xBVyYdUpx84nWx7', password: 'dwwTxtvv5a10RXn' },
    });

    await context.addCookies(cookies);
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(30000);

    try {
        // 1. Warmup
        console.log('[1] Warmup...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(5000);
        console.log('  URL:', page.url());
        await page.screenshot({ path: '/tmp/01_feed.png' });

        // 2. Profile
        console.log('[2] Profile...');
        await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(randomRange(10000, 12000));
        console.log('  URL:', page.url());
        await page.screenshot({ path: '/tmp/02_profile.png' });

        // 3. Click Message
        console.log('[3] Clicking Message...');
        const msgBtn = page.locator('button:has-text("Message")').first();
        if (await msgBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await msgBtn.click({ force: true });
            console.log('  Clicked');
        } else {
            console.log('  Button not found');
        }

        await wait(8000);
        console.log('  URL:', page.url());
        await page.screenshot({ path: '/tmp/03_after_message_click.png' });

        // 4. Wait more
        await wait(10000);
        await page.screenshot({ path: '/tmp/04_after_extra_wait.png' });

        // 5. Check what modals exist
        const modals = await page.evaluate(() => {
            const results: any[] = [];
            document.querySelectorAll('.contextual-sign-in-modal, .artdeco-modal, [role="dialog"], .sign-in-modal').forEach(el => {
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    results.push({
                        class: el.className?.substring?.(0, 120),
                        text: el.textContent?.trim().substring(0, 300),
                    });
                }
            });
            return results;
        });
        console.log('\n=== VISIBLE MODALS ===');
        modals.forEach((m, i) => console.log(`\n[Modal ${i}]\n${m.class}\n${m.text}`));

    } catch (err: any) {
        console.error('ERROR:', err.message);
    }

    await browser.close();
    await prisma.$disconnect();
    console.log('\nScreenshots saved to /tmp/0*.png');
}

main().catch(console.error);
