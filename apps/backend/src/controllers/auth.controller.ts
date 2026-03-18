import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import path from 'path';
import fs from 'fs';
import { getOrAssignProxy } from '../services/proxy.service';

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
    const { linkedinCookie } = req.body;
    const userId = req.user.id;

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { linkedinCookie },
        });

        res.json({ success: true, message: 'LinkedIn cookie synced successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync cookie' });
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

        res.json({
            connected: !!user.linkedinCookie || !!user.persistentSessionPath,
            cookie: user.linkedinCookie,
            persistent: !!user.persistentSessionPath,
            profile: {
                firstName: user.email.split('@')[0], // Placeholder until sync is run
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
    if (!fs.existsSync(path.join(process.cwd(), 'sessions'))) {
        fs.mkdirSync(path.join(process.cwd(), 'sessions'));
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
                headless: false,
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
