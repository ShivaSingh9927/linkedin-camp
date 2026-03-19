import { Request, Response } from 'express';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import { getOrAssignProxy } from '../services/proxy.service';
import path from 'path';

chromium.use(stealth);

// In-memory store for active login sessions (to handle 2FA)
const activeSessions: Record<string, {
    context: any;
    page: any;
    timestamp: number;
}> = {};

// Clean up old sessions every 10 mins
setInterval(() => {
    const now = Date.now();
    Object.keys(activeSessions).forEach(async (userId) => {
        if (now - activeSessions[userId].timestamp > 10 * 60 * 1000) {
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
        console.log(`[SIMULATION] Starting login for user ${userId} (${email})...`);

        // 1. Assign Proxy
        const userWithProxy = await getOrAssignProxy(userId);

        // 2. Launch Stealth Browser
        const launchOptions: any = {
            headless: true, // MUST be headless on Railway
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        };

        if (userWithProxy?.proxy) {
            launchOptions.proxy = {
                server: `${userWithProxy.proxy.proxyHost}:${userWithProxy.proxy.proxyPort}`,
                username: userWithProxy.proxy.proxyUsername || undefined,
                password: userWithProxy.proxy.proxyPassword || undefined
            };
        }

        const browser = await chromium.launch(launchOptions);
        const context = await browser.newContext();
        const page = await context.newPage();

        // 3. Navigate to Login
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

        // 4. Enter Credentials
        await page.fill('#username', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        // 5. Detect state
        await page.waitForTimeout(5000); // Give it a moment to react

        const currentUrl = page.url();
        console.log(`[SIMULATION] Current URL after login attempt: ${currentUrl}`);

        if (currentUrl.includes('/checkpoint/challenge')) {
            // Need 2FA
            activeSessions[userId] = { context, page, timestamp: Date.now() };
            return res.json({
                success: true,
                requires2FA: true,
                message: 'LinkedIn requires security verification. Please enter the code sent to your email.'
            });
        }

        if (currentUrl.includes('/feed')) {
            // Instant Success (Rare)
            const cookies = await context.cookies();
            const liAt = cookies.find(c => c.name === 'li_at')?.value;

            await prisma.user.update({
                where: { id: userId },
                data: { linkedinCookie: liAt }
            });

            await browser.close();
            return res.json({ success: true, connected: true });
        }

        // Error fallback
        await browser.close();
        return res.status(400).json({ error: 'Login failed. Please check your credentials or try again later.' });

    } catch (error: any) {
        console.error(`[SIMULATION] Error during login for ${userId}:`, error.message);
        res.status(500).json({ error: 'Internal server error during simulated login' });
    }
};

export const submitSimulation2FA = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || !activeSessions[userId]) {
        return res.status(400).json({ error: 'Invalid session or missing code' });
    }

    const { page, context } = activeSessions[userId];

    try {
        console.log(`[SIMULATION] Submitting 2FA code for user ${userId}...`);

        // Fill the 2FA input (LinkedIn uses various selectors, common are 'input#input-code' or just looking for the pin-input)
        const selectors = ['input#input-code', 'input[name="pin"]', '.checkpoint-code-input'];
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
            return res.status(400).json({ error: 'Could not find verification code input' });
        }

        await page.click('#email-pin-submit-button, button[type="submit"]');
        await page.waitForTimeout(10000); // Wait for feed

        if (page.url().includes('/feed') || page.url().includes('/in/')) {
            const cookies = await context.cookies();
            const liAt = cookies.find(c => c.name === 'li_at')?.value;

            await prisma.user.update({
                where: { id: userId },
                data: { linkedinCookie: liAt }
            });

            await context.close();
            delete activeSessions[userId];
            return res.json({ success: true, connected: true });
        }

        res.status(400).json({ error: 'Verification failed. Please try again.' });

    } catch (error: any) {
        console.error(`[SIMULATION] Error during 2FA for ${userId}:`, error.message);
        res.status(500).json({ error: 'Internal server error during 2FA' });
    }
};
