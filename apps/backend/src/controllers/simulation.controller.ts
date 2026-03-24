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
    type?: 'SIMULATION' | 'PHASE1';
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

        if (userWithProxy) {
            console.log(`[SIMULATION] Routing request through proxy: ${userWithProxy.proxyIp}`);
            launchOptions.proxy = {
                server: `${userWithProxy.proxyHost}:${userWithProxy.proxyPort}`,
                username: userWithProxy.proxyUsername || undefined,
                password: userWithProxy.proxyPassword || undefined
            };
        } else {
            console.warn(`[SIMULATION] No proxy assigned for user ${userId}. Proceeding with direct connection.`);
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
        let currentUrl = page.url();
        console.log(`[SIMULATION] Post-login URL: ${currentUrl}`);

        // Handle intermediate challenges (e.g. "Select verification method" or "Send code" screens)
        const isChallenge = currentUrl.includes('/checkpoint/challenge') || 
                          await page.isVisible('.checkpoint-code-input') ||
                          await page.isVisible('button:has-text("Send code")') ||
                          await page.isVisible('button:has-text("Continue")');

        if (isChallenge) {
            console.log(`[SIMULATION] Security Challenge detected for user ${userId}`);
            
            // If there's a "Send code" or "Continue" button, click it to actually trigger the 2FA email
            const triggerButtons = [
                'button:has-text("Send code")', 
                'button:has-text("Continue")', 
                'button#email-pin-submit-button',
                '.checkpoint-continue'
            ];
            
            for (const btn of triggerButtons) {
                if (await page.isVisible(btn)) {
                    console.log(`[SIMULATION] Clicking trigger button: ${btn}`);
                    await page.click(btn);
                    await page.waitForTimeout(5000);
                    break;
                }
            }

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
                    persistentSessionPath: sessionPath,
                    linkedinActiveInBrowser: false // Reset extension state when cloud takes over
                }
            });

            await page.waitForTimeout(5000); // Allow session to stabilize
            await context.close();
            return res.json({ success: true, connected: true });
        }

        // Fallback for unexpected states - take a screenshot for debugging
        console.log(`[SIMULATION] Unexpected state. URL: ${page.url()}`);
        const screenshotPath = path.join(process.cwd(), 'sessions', `${userId}_error.png`);
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        
        const errorText = await page.innerText('.alert-content, #error-for-password').catch(() => null);
        await context.close();
        return res.status(400).json({ 
            error: errorText || 'Verification failed. Please check your email/password and try again.' 
        });

    } catch (error: any) {
        console.error(`[SIMULATION] Fatal error for ${userId}:`, error.message);
        if (activeSessions[userId]) {
            await activeSessions[userId].context.close().catch(() => {});
            delete activeSessions[userId];
        }
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
            await page.keyboard.press('Tab'); // Often focuses the first input
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
                    persistentSessionPath: sessionPath,
                    linkedinActiveInBrowser: false
                }
            });

            await page.waitForTimeout(5000); // CRITICAL: Save session files to disk
            await context.close();
            delete activeSessions[userId];
            return res.json({ success: true, connected: true });
        }

        console.log(`[SIMULATION] Post-2FA URL: ${page.url()}`);
        const errorScreenshot = path.join(process.cwd(), 'sessions', `${userId}_2fa_error.png`);
        await page.screenshot({ path: errorScreenshot }).catch(() => {});
        
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

export const startPhase1PersistentSync = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        console.log(`[PHASE 1] Starting MANUAL persistent sync for user ${userId}...`);

        // 1. Setup Session Directory
        const sessionPath = path.join(process.cwd(), 'sessions', userId);
        if (!fs.existsSync(path.join(process.cwd(), 'sessions'))) {
            fs.mkdirSync(path.join(process.cwd(), 'sessions'), { recursive: true });
        }

        // 2. Launch Persistent Context (HEADED)
        const context = await chromium.launchPersistentContext(sessionPath, {
            headless: false, // User needs to see this!
            args: [
                '--disable-blink-features=AutomationControlled',
                '--start-maximized'
            ],
            viewport: null
        });

        const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
        activeSessions[userId] = { context, page, timestamp: Date.now(), type: 'PHASE1' };

        console.log(`[PHASE 1] Navigating to LinkedIn Login...`);
        await page.goto('https://www.linkedin.com/login');

        // Start a background loop to check for login success
        const checkLogin = setInterval(async () => {
            try {
                if (page.isClosed()) {
                    clearInterval(checkLogin);
                    delete activeSessions[userId];
                    return;
                }

                if (page.url().includes('/feed')) {
                    console.log(`[PHASE 1] Login detected for user ${userId}!`);
                    clearInterval(checkLogin);
                    
                    // Capture UA for identity cloning (optional but good)
                    // const userAgent = await page.evaluate(() => navigator.userAgent);
                    
                    // Wait 15s to ensure session is saved to disk
                    await page.waitForTimeout(15000);
                    
                    await prisma.user.update({
                        where: { id: userId },
                        data: { 
                            persistentSessionPath: sessionPath,
                            linkedinCookie: (await context.cookies()).find(c => c.name === 'li_at')?.value
                        }
                    });

                    console.log(`[PHASE 1] Session saved for user ${userId}. Closing browser.`);
                    await context.close();
                    delete activeSessions[userId];
                }
            } catch (e) {
                clearInterval(checkLogin);
            }
        }, 5000);

        res.json({ 
            success: true, 
            message: 'Manual login window opened. Please login in the browser window on the server.' 
        });

    } catch (error: any) {
        console.error(`[PHASE 1] Error:`, error.message);
        res.status(500).json({ error: 'Failed to launch manual login window.' });
    }
};
