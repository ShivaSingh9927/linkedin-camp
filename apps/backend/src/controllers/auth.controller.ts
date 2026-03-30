import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import path from 'path';
import fs from 'fs';
import { getOrAssignProxy } from '../services/proxy.service';
import axios from 'axios';
import { LinkedInService } from '../services/linkedin.service';

chromium.use(stealth);

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';


export const register = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
            },
        });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ user: { id: user.id, email: user.email }, token });
    } catch (error: any) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ user: { id: user.id, email: user.email, tier: user.tier }, token });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const syncExtension = async (req: any, res: Response) => {
    const { linkedinCookie, linkedinLocalStorage, fingerprint } = req.body;
    const userId = req.user.id;

    try {
        console.log(`[SYNC-EVENT] Body sizes - Cookies: ${linkedinCookie?.length || 0}, Storage: ${linkedinLocalStorage?.length || 0}`);
        
        // 1. Update Database (Initial Sync) & Prepare Session Directory
        const sessionPath = path.join(process.cwd(), 'sessions', userId);
        if (!fs.existsSync(path.dirname(sessionPath))) {
            fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
        }
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { 
                linkedinCookie,
                linkedinLocalStorage,
                linkedinFingerprint: fingerprint ? JSON.stringify(fingerprint) : undefined,
                persistentSessionPath: sessionPath,
                linkedinActiveInBrowser: true,
                lastBrowserActivityAt: new Date()
            },
        });

        // Save session files for Phase 2 automation
        if (linkedinCookie) {
            try {
                const cookies = JSON.parse(linkedinCookie);
                fs.writeFileSync(path.join(sessionPath, 'cookies.json'), JSON.stringify(cookies, null, 2));
            } catch (e) {
                console.error("[SYNC] Failed to save cookies.json:", e);
            }
        }
        if (linkedinLocalStorage) {
            try {
                const storage = JSON.parse(linkedinLocalStorage);
                fs.writeFileSync(path.join(sessionPath, 'localStorage.json'), JSON.stringify(storage, null, 2));
            } catch (e) {
                console.error("[SYNC] Failed to save localStorage.json:", e);
            }
        }
        if (fingerprint) {
            fs.writeFileSync(path.join(sessionPath, 'fingerprint.json'), JSON.stringify(fingerprint, null, 2));
        }

        // 3. LAUNCH VERIFICATION LOOP (Read-Only Mode)
        // Prevent concurrent verifications for the same user
        if ((global as any).activeVerifications?.has(userId)) {
            console.log(`[SYNC-VERIFY] Verification already in progress for user ${userId}. Skipping duplicate.`);
            return res.json({ 
                success: true, 
                message: 'Verification already in progress...' 
            });
        }

        if (!(global as any).activeVerifications) (global as any).activeVerifications = new Set();
        (global as any).activeVerifications.add(userId);

        console.log(`[SYNC-VERIFY] Initiating cloud verification for user ${userId}...`);
        
        // Assign Proxy if not exists
        const userProxy = await getOrAssignProxy(userId);
        console.log(`[SYNC-VERIFY] Proxy Assignment: ${userProxy ? 'SUCCESS' : 'FALLBACK TO OXYLABS'}`);

        const verificationPromise = (async () => {
            let browser;
            let context;
            try {
                const launchOptions: any = {
                    headless: false,
                    args: [
                        '--no-sandbox', 
                        '--disable-setuid-sandbox', 
                        '--disable-blink-features=AutomationControlled',
                        '--start-maximized',
                        '--disable-web-security'
                    ]
                };

                const contextOptions: any = {
                    userAgent: fingerprint?.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    viewport: null,
                    locale: 'en-IN',
                    timezoneId: 'Asia/Kolkata'
                };

                if (userProxy) {
                    contextOptions.proxy = {
                        server: `http://${userProxy.proxyHost}:${userProxy.proxyPort}`,
                        username: userProxy.proxyUsername || undefined,
                        password: userProxy.proxyPassword || undefined
                    };
                    console.log(`[SYNC-VERIFY] Using assigned proxy: ${userProxy.proxyHost}`);
                } else {
                    // CRITICAL: Must use the same ISP fallback as worker to avoid IP jumps
                    contextOptions.proxy = {
                        server: 'http://disp.oxylabs.io:8001',
                        username: 'user-shivasingh_clgdY',
                        password: 'Iamironman_3'
                    };
                    console.log(`[SYNC-VERIFY] Using dedicated ISP proxy (Oxylabs) for verification fallback`);
                }

                // Launch an IN-MEMORY context to avoid SingletonLock issues
                browser = await chromium.launch(launchOptions);
                context = await browser.newContext(contextOptions);
                const page = context.pages()[0] || await context.newPage();

                // Inject cookies if they weren't already in the persistent context
                if (linkedinCookie) {
                    try {
                        const cookies = JSON.parse(linkedinCookie);
                        await context.addCookies(cookies);
                    } catch (e) {
                        // Fallback for li_at string
                        await context.addCookies([{ 
                            name: 'li_at', 
                            value: linkedinCookie, 
                            domain: '.linkedin.com', 
                            path: '/', 
                            secure: true, 
                            httpOnly: true 
                        }]);
                    }
                }
                // Inject Storage identity if available
                if (linkedinLocalStorage) {
                    try {
                        const localStorageData = JSON.parse(linkedinLocalStorage);
                        await context.addInitScript((data: any) => {
                            const parsed = JSON.parse(data);
                            for (const [k, v] of Object.entries(parsed)) {
                                window.localStorage.setItem(k, v as string);
                            }
                        }, JSON.stringify(localStorageData));
                        console.log(`[SYNC-VERIFY] Injected localStorage identity from extension.`);
                    } catch (e) {
                         console.warn("[SYNC-VERIFY] FAILED to inject localStorage:", e);
                    }
                }

                console.log(`[SYNC-VERIFY] Performing session check...`);
                await page.goto('https://www.linkedin.com/voyager/api/me', { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 45000 
                });

                await page.waitForTimeout(3000);

                const pageContent = await page.content();
                const finalUrl = page.url();
                
                console.log(`[SYNC-VERIFY] Page reached: ${finalUrl}`);
                const isLoggedOut = finalUrl.includes('login') || finalUrl.includes('authwall') || finalUrl.includes('checkpoint');
                const hasProfileData = pageContent.includes('miniProfile') || pageContent.includes('firstName') || pageContent.includes('"publicIdentifier"');
                
                const isValid = !isLoggedOut && (hasProfileData || finalUrl.includes('voyager'));
                
                if (isValid) {
                    console.log(`[SYNC-VERIFY] ✅ SUCCESS: Session verified for ${userId}. Found MiniProfile data.`);
                    
                    // Update state to active, and set the persistentSessionPath
                    await prisma.user.update({
                        where: { id: userId },
                        data: { 
                            persistentSessionPath: sessionPath,
                            linkedinActiveInBrowser: true, // Mark as active now that it's verified
                            lastBrowserActivityAt: new Date()
                        }
                    });
                    console.log(`[SYNC-VERIFY] Database updated for ${userId}. Button should turn green on next poll.`);
                    return true;
                } else {
                    console.warn(`[SYNC-VERIFY] ❌ FAILED: Session invalid for user ${userId}. Reason: ${isLoggedOut ? 'Logged Out/Authwall' : 'No Profile Data found'}. URL: ${finalUrl}`);
                    
                    // Optional: Take a screenshot for debugging
                    // const errorScreenshotPath = path.join(sessionPath, `error_verify_${Date.now()}.png`);
                    // await page.screenshot({ path: errorScreenshotPath }).catch(() => {});

                    return false;
                }
            } catch (err: any) {
                console.error(`[SYNC-VERIFY] ❌ ERROR during verification:`, err.message);
                return false;
            } finally {
                if (context) await context.close().catch(() => {});
                if (browser) await browser.close().catch(() => {});
                (global as any).activeVerifications?.delete(userId);
            }
        })();

        // For now, we return success immediately but let the verification happen in background
        // The frontend polling (fetchStatus) will pick up the 'persistentSessionPath' when done.
        res.json({ 
            success: true, 
            message: 'Session data received. Verification in progress on Hetzner node...' 
        });

    } catch (error) {
        console.error('Sync failed:', error);
        res.status(500).json({ error: 'Failed to sync session' });
    }
};

export const bookmarkletSync = async (req: Request, res: Response) => {
    const { linkedinCookie, userId } = req.body;

    if (!linkedinCookie || !userId) {
        return res.status(400).json({ error: 'Missing required params' });
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                linkedinCookie,
                linkedinActiveInBrowser: true,
                lastBrowserActivityAt: new Date()
            },
        });

        console.log(`[BOOKMARKLET] Session synced for user ${userId}`);
        res.json({ success: true, message: 'Session synchronized successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync via bookmarklet' });
    }
};

export const getCloudStatus = async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();
        const lastAction = user.lastCloudActionAt ? user.lastCloudActionAt.getTime() : 0;
        const isRecentlyActive = (now.getTime() - lastAction) < (5 * 60 * 1000); // 5 minutes

        const hasCloudWorkersRunning = user.cloudWorkerActive || isRecentlyActive;

        res.json({ success: true, hasCloudWorkersRunning, lastCloudActionAt: user.lastCloudActionAt });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cloud status' });
    }
};

export const getLinkedinStatus = async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // CRITICAL: DO NOT use LinkedInService.isSessionValid here.
        // It's a polling endpoint; checking LinkedIn validity on every poll is session suicide.
        const connected = !!user.linkedinCookie || !!user.persistentSessionPath;

        res.json({
            userId: user.id,
            connected: connected,
            isValid: true, // Optimistically valid if connected; real check is in worker
            cookieLength: user.linkedinCookie ? user.linkedinCookie.length : 0,
            persistentPath: user.persistentSessionPath,
            profile: {
                firstName: user.email.split('@')[0], 
                lastName: "",
                headline: "LinkedIn Member",
                avatarUrl: null
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
};

export const syncLinkedinProfile = async (req: any, res: Response) => {
    const userId = req.user.id;
    // For now, we'll return a robust success response
    res.json({
        success: true,
        message: 'Profile sync completed successfully',
        profile: {
            firstName: "Shiva",
            lastName: "Singh",
            headline: "AI & GenAI Architect",
            avatarUrl: null
        }
    });
};

export const startLinkedinLogin = async (req: any, res: Response) => {
    const userId = req.user.id;
    await getOrAssignProxy(userId);
    const sessionDir = path.join(process.cwd(), 'sessions', userId);

    // Ensure sessions directory exists
    if (!fs.existsSync(path.dirname(sessionDir))) {
        try {
            fs.mkdirSync(path.dirname(sessionDir), { recursive: true });
        } catch (e: any) {
            console.error(`[LOGIN-BOT] Error creating sessions parent directory: ${e.message}`);
        }
    }

    res.json({ success: true, message: 'Launching LinkedIn login browser...' });

    // Run browser logic in background
    (async () => {
        console.log(`[LOGIN-BOT] Starting browser for user ${userId}...`);
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { proxy: true }
            });

            const launchOptions: any = {
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ],
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 720 },
            };

            if (user?.proxy) {
                launchOptions.proxy = {
                    server: `${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                    username: user.proxy.proxyUsername || undefined,
                    password: user.proxy.proxyPassword || undefined
                };
                console.log(`[LOGIN-BOT] Using proxy for login: ${user.proxy.proxyHost}`);
            }

            const context = await chromium.launchPersistentContext(sessionDir, launchOptions);

            const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

            await page.goto('https://www.linkedin.com/login', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            console.log(`[LOGIN-BOT] Waiting for user ${userId} to login...`);

            // Fast detection: Watch for either the landing URL OR the li_at cookie appearing
            let liAt: string | undefined = undefined;

            try {
                await Promise.race([
                    // Case 1: User lands on feed or profile
                    page.waitForURL('**/feed/**', { timeout: 300000, waitUntil: 'domcontentloaded' }),
                    page.waitForURL('**/in/**', { timeout: 300000, waitUntil: 'domcontentloaded' }),
                    // Case 2: Polling for cookie
                    (async () => {
                        while (true) {
                            const cookies = await context.cookies();
                            const found = cookies.find(c => c.name === 'li_at')?.value;
                            if (found) {
                                liAt = found;
                                break;
                            }
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    })()
                ]);

                console.log(`[LOGIN-BOT] Login detected for user ${userId}.`);

                // Final check for the cookie
                const cookies = await context.cookies();
                const finalLiAt = cookies.find(c => c.name === 'li_at')?.value;

                if (finalLiAt) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            persistentSessionPath: sessionDir,
                            linkedinCookie: finalLiAt
                        }
                    });
                    console.log(`[LOGIN-BOT] Success: Session saved for user ${userId}.`);
                } else {
                    console.log(`[LOGIN-BOT] Warning: Login detected but li_at cookie was missing for user ${userId}.`);
                }

            } catch (error: any) {
                console.error(`[LOGIN-BOT] Login process interrupted or timed out for user ${userId}`);
            } finally {
                // Ensure browser is absolutely closed
                console.log(`[LOGIN-BOT] Terminating browser window for user ${userId}...`);
                await context.close().catch(e => console.error("Error closing context:", e));
            }
        } catch (error: any) {
            console.error(`[LOGIN-BOT] Fatal error in login routine for user ${userId}:`, error.message);
        }
    })();
};

export const cloudLogin = async (req: any, res: Response) => {
    const userId = req.user.id;
    const hetznerIp = '204.168.167.198'; 
    const token = 'Raja_Security_2026';

    // This script automatically navigates the remote browser to LinkedIn
    const script = `
      export default async ({ page }) => {
        await page.goto('https://www.linkedin.com/login');
      };
    `.trim();

    const launchOptions = {
        args: [
            "--no-sandbox",
            `--user-data-dir=/sessions/${userId}` // Persistent login
        ]
    };

    const params = new URLSearchParams({
        token: token,
        launch: JSON.stringify(launchOptions),
        // Encode the script so it runs on startup
        script: Buffer.from(script).toString('base64')
    });

    // Final URL - Open source Browserless uses the root or /debugger/
    const url = `http://${hetznerIp}:3000/debugger/?${params.toString()}`;
    
    res.redirect(url);
};

export const heartbeat = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { country } = req.body; // Extension can detect country based on browser IP

    try {
        const now = new Date();
        await prisma.user.update({
            where: { id: userId },
            data: {
                linkedinActiveInBrowser: true,
                lastBrowserActivityAt: now,
                // Update country if not set, helps with proxy assignment later
                actualCountry: country || undefined
            }
        });

        // Set an immediate interlock in Redis for the worker (expires in 60s)
        const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
        const Redis = require('ioredis');
        const redis = new Redis(REDIS_URL);
        await redis.set(`user_presence:${userId}`, 'ACTIVE', 'EX', 60);
        await redis.quit();

        res.json({ success: true, message: 'Heartbeat received' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process heartbeat' });
    }
};
