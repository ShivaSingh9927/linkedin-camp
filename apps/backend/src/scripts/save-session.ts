import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import path from 'path';
import { prisma } from '../server';

chromium.use(stealth);

async function savePersistentSession(userId: string) {
    if (!userId) {
        console.error('❌ Error: Please provide a User ID');
        process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.error(`❌ Error: User with ID ${userId} not found`);
        process.exit(1);
    }

    const sessionDir = path.join(process.cwd(), 'sessions', userId);
    console.log(`[PERSISTENT] Starting browser for user: ${user.email}`);
    console.log(`[PERSISTENT] Session directory: ${sessionDir}`);
    console.log('[PERSISTENT] If a login screen appears, please enter your credentials.');
    console.log('[PERSISTENT] Solving any CAPTCHAs or 2FA codes manually in the window.');

    const context = await chromium.launchPersistentContext(sessionDir, {
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    try {
        console.log('[PERSISTENT] Navigating to LinkedIn Login...');
        await page.goto('https://www.linkedin.com/login', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log('[PERSISTENT] Waiting for successful login (solve CAPTCHA/2FA manually)...');
        // Wait for the feed URL, which indicates a successful login
        await page.waitForURL('**/feed/**', { timeout: 300000 });

        console.log('✅ LOGIN SUCCESSFUL!');
        console.log('[PERSISTENT] Waiting 15s to ensure all session data is written to disk...');
        await page.waitForTimeout(15000);

        // Update user in DB
        await prisma.user.update({
            where: { id: userId },
            data: {
                persistentSessionPath: sessionDir,
                // Also update the last sync time or similar if needed
                lastCloudActionAt: new Date()
            }
        });

        console.log(`✅ Session fully saved and linked to user ${user.email} in database.`);

    } catch (error: any) {
        console.log('❌ ERROR or TIMEOUT:', error.message);
    } finally {
        await context.close();
        console.log('[PERSISTENT] Browser closed.');
        process.exit(0);
    }
}

// Get userId from command line
const userId = process.argv[2];
savePersistentSession(userId);
