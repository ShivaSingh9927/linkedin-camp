import { Request, Response } from 'express';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import { getOrAssignProxy } from '../services/proxy.service';
import path from 'path';
import fs from 'fs';

chromium.use(stealth);

// In-memory store for active login sessions (to handle 2FA)
const activeSessions: Record<string, {
    context: any;
    page: any;
    timestamp: number;
    browser?: any;
}> = {};

// Clean up old sessions every 15 mins
setInterval(() => {
    const now = Date.now();
    Object.keys(activeSessions).forEach(async (userId) => {
        if (now - activeSessions[userId].timestamp > 15 * 60 * 1000) {
            console.log(`[SIMULATION] Cleaning up expired session for user ${userId}`);
            await activeSessions[userId].context.close().catch(() => { });
            delete activeSessions[userId];
        }
    });
}, 5 * 60 * 1000);

export const startSimulationLogin = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        console.log(`[SIMULATION] Starting persistent login for user ${userId} (${email})...`);

        // 1. Assign Proxy
        const userWithProxy = await getOrAssignProxy(userId);
        
        // 2. Setup Session Directory
        const sessionPath = path.join(process.cwd(), 'sessions', userId);
        if (!fs.existsSync(path.join(process.cwd(), 'sessions'))) {
            fs.mkdirSync(path.join(process.cwd(), 'sessions'), { recursive: true });
        }

        // 3. Launch Persistent Context (Just like login_and_save.js)
        const launchOptions: any = {
            headless: true, // MUST be headless on cloud
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
            ],
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            viewport: { width: 1440, height: 900 },
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
            }
        };

        if (userWithProxy?.proxy) {
            launchOptions.proxy = {
                server: `${userWithProxy.proxy.proxyHost}:${userWithProxy.proxy.proxyPort}`,
                username: userWithProxy.proxy.proxyUsername || undefined,
                password: userWithProxy.proxy.proxyPassword || undefined
            };
        }

        const context = await chromium.launchPersistentContext(sessionPath, launchOptions);
        const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

        // 4. Navigate to Login
        console.log(`[SIMULATION] Navigating to LinkedIn Login...`);
        await page.goto('https://www.linkedin.com/login', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });

        // 5. Check if already logged in (using persistent session)
        if (page.url().includes('/feed')) {
            const cookies = await context.cookies();
            const liAt = cookies.find(c => c.name === 'li_at')?.value;
            await prisma.user.update({
                where: { id: userId },
                data: { 
                    linkedinCookie: liAt,
                    persistentSessionPath: sessionPath
                }
            });
            await context.close();
            return res.json({ success: true, connected: true });
        }

        // 6. Enter Credentials
        console.log(`[SIMULATION] Entering credentials...`);
        await page.waitForSelector('#username', { timeout: 10000 });
        await page.fill('#username', email);
        await page.fill('#password', password);
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        ]);

        // 7. Detect State (Challenge vs Feed)
        const currentUrl = page.url();
        console.log(`[SIMULATION] Current URL: ${currentUrl}`);

        if (currentUrl.includes('/checkpoint/challenge') || await page.isVisible('.checkpoint-code-input')) {
            console.log(`[SIMULATION] 2FA Required for user ${userId}`);
            activeSessions[userId] = { context, page, timestamp: Date.now() };
            return res.json({
                success: true,
                requires2FA: true,
                message: 'LinkedIn Security Check: Please enter the code sent to your email.'
            });
        }

        if (currentUrl.includes('/feed')) {
            console.log(`[SIMULATION] Login Success for user ${userId}`);
            const cookies = await context.cookies();
            const liAt = cookies.find(c => c.name === 'li_at')?.value;

            await prisma.user.update({
                where: { id: userId },
                data: { 
                    linkedinCookie: liAt,
                    persistentSessionPath: sessionPath
                }
            });

            await page.waitForTimeout(5000); // Allow session to stabilize
            await context.close();
            return res.json({ success: true, connected: true });
        }

        // Fallback for unexpected states
        const errorText = await page.innerText('.alert-content, #error-for-password').catch(() => null);
        await context.close();
        return res.status(400).json({ 
            error: errorText || 'Verification failed. Please check your email/password and try again.' 
        });

    } catch (error: any) {
        console.error(`[SIMULATION] Fatal error for ${userId}:`, error.message);
        res.status(500).json({ error: 'Cloud browser error. Please try again in a few minutes.' });
    }
};

export const submitSimulation2FA = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || !activeSessions[userId]) {
        return res.status(400).json({ error: 'Session expired or invalid. Please start over.' });
    }

    const { page, context } = activeSessions[userId];

    try {
        console.log(`[SIMULATION] Submitting 2FA code for user ${userId}: ${code}`);

        const selectors = [
            'input#input-code', 
            'input[name="pin"]', 
            '.checkpoint-code-input',
            'input[aria-label="Verification code"]'
        ];
        
        let filled = false;
        for (const selector of selectors) {
            try {
                if (await page.isVisible(selector)) {
                    await page.fill(selector, code);
                    filled = true;
                    break;
                }
            } catch { }
        }

        if (!filled) {
            // Try typing blindly if selector fails but it's clearly a pin page
            await page.keyboard.type(code);
            filled = true;
        }

        await Promise.all([
            page.click('#email-pin-submit-button, button[type="submit"], .checkpoint-continue'),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        ]);

        // Wait up to 15s for the feed
        for (let i = 0; i < 5; i++) {
            if (page.url().includes('/feed') || page.url().includes('/in/')) break;
            await page.waitForTimeout(3000);
        }

        if (page.url().includes('/feed') || page.url().includes('/in/')) {
            console.log(`[SIMULATION] 2FA Verified! Saving session for user ${userId}`);
            const cookies = await context.cookies();
            const liAt = cookies.find((c: any) => c.name === 'li_at')?.value;
            const sessionPath = path.join(process.cwd(), 'sessions', userId);

            await prisma.user.update({
                where: { id: userId },
                data: { 
                    linkedinCookie: liAt,
                    persistentSessionPath: sessionPath
                }
            });

            await page.waitForTimeout(10000); // CRITICAL: Save session files to disk
            await context.close();
            delete activeSessions[userId];
            return res.json({ success: true, connected: true });
        }

        console.log(`[SIMULATION] Post-2FA URL: ${page.url()}`);
        res.status(400).json({ error: 'Verification failed. The code may be incorrect or expired.' });

    } catch (error: any) {
        console.error(`[SIMULATION] Error during 2FA for ${userId}:`, error.message);
        if (activeSessions[userId]) {
            await activeSessions[userId].context.close().catch(() => {});
            delete activeSessions[userId];
        }
        res.status(500).json({ error: 'Verification error. Please try again.' });
    }
};
