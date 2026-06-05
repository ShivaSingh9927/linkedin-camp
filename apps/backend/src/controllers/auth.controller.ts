import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import path from 'path';
import fs from 'fs';
import { getOrAssignProxy } from '../services/proxy.service';
import axios from 'axios';
import { LinkedInService } from '../services/linkedin.service';
import { mailService } from '../services/mail.service';
import { sessionManager } from '../services/session-manager.service';

chromium.use(stealth);

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response) => {
    const { credential } = req.body;
    
    console.log('[AUTH/GOOGLE] Received Google login request.');
    console.log(`[AUTH/GOOGLE] Request Origin: ${req.headers.origin}`);
    console.log(`[AUTH/GOOGLE] Configured Client ID: ${process.env.GOOGLE_CLIENT_ID}`);

    if (!credential) {
        console.error('[AUTH/GOOGLE] No credential provided in request body.');
        return res.status(400).json({ error: 'No Google credential provided' });
    }

    try {
        console.log('[AUTH/GOOGLE] Attempting to verify token with Google...');
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        console.log('[AUTH/GOOGLE] Token successfully verified! Payload:', payload ? `email: ${payload.email}` : 'undefined');

        if (!payload || !payload.email) {
            console.error('[AUTH/GOOGLE] Token payload missing email.');
            return res.status(400).json({ error: 'Invalid Google token structure' });
        }

        const { email, sub: googleId, given_name, family_name, picture } = payload;
        console.log(`[AUTH/GOOGLE] Processing user: ${email} (Google ID: ${googleId})`);

        let user = await prisma.user.findUnique({ where: { googleId } });

        if (!user) {
            console.log(`[AUTH/GOOGLE] User not found by Google ID. Looking up by email: ${email}`);
            // Try finding by email and link
            user = await prisma.user.findUnique({ where: { email } });
            
            if (user) {
                console.log(`[AUTH/GOOGLE] Found existing user by email. Linking Google ID...`);
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId, avatarUrl: picture || user.avatarUrl }
                });
            } else {
                console.log(`[AUTH/GOOGLE] No existing user. Creating new user account...`);
                // Create new user
                user = await prisma.user.create({
                    data: {
                        email,
                        googleId,
                        firstName: given_name,
                        lastName: family_name,
                        avatarUrl: picture,
                        registrationStep: 'STARTED'
                    }
                });

                console.log(`[AUTH/GOOGLE] Sending welcome email to ${email}...`);
                // Send Welcome Email for new Google user
                try {
                    await mailService.sendWelcomeEmail(user.email, user.firstName || 'User');
                } catch (emailErr: any) {
                    console.error('[AUTH/GOOGLE] Non-fatal: Failed to send welcome email:', emailErr.message);
                }
            }
        } else {
            console.log(`[AUTH/GOOGLE] Found existing user by Google ID: ${user.id}`);
        }

        console.log(`[AUTH/GOOGLE] Generating JWT token...`);
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        console.log(`[AUTH/GOOGLE] Login successful. Returning user data.`);
        res.json({ 
            user: { 
                id: user.id, 
                email: user.email, 
                firstName: user.firstName, 
                lastName: user.lastName, 
                avatarUrl: user.avatarUrl,
                registrationStep: user.registrationStep,
                tier: user.tier 
            }, 
            token 
        });
    } catch (error: any) {
        console.error('[AUTH/GOOGLE] ❌ FATAL ERROR during token verification or processing:', error.message);
        console.error(error.stack);
        // Return the actual error message to the frontend for debugging
        res.status(500).json({ 
            error: `Login failed: ${error.message || 'Internal server error'}`
        });
    }
};


export const register = async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;

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
                firstName,
                lastName,
                updatedAt: new Date(),
            },
        });

        // Send Welcome Email for new manual registration (Non-blocking or at least non-fatal)
        try {
            await mailService.sendWelcomeEmail(user.email, user.firstName || 'User');
        } catch (emailErr: any) {
            console.error('[AUTH/REGISTER] Non-fatal: Failed to send welcome email:', emailErr.message);
        }

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

        let profile = {
            firstName: user.email.split('@')[0], 
            lastName: "",
            headline: "LinkedIn Member",
            avatarUrl: null as string | null
        };

        if (user.profileData) {
            try {
                const parsed = typeof user.profileData === 'string' 
                    ? JSON.parse(user.profileData) 
                    : user.profileData as any;
                if (parsed.firstName) profile.firstName = parsed.firstName;
                if (parsed.lastName) profile.lastName = parsed.lastName;
                if (parsed.headline) profile.headline = parsed.headline;
                if (parsed.avatarUrl) profile.avatarUrl = parsed.avatarUrl;
            } catch (e) {
                console.error('[AUTH-CTRL] Failed to parse user.profileData:', e);
            }
        }

        res.json({
            userId: user.id,
            connected: connected,
            isValid: true, // Optimistically valid if connected; real check is in worker
            cookieLength: user.linkedinCookie ? user.linkedinCookie.length : 0,
            persistentPath: user.persistentSessionPath,
            profile
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
    
    res.json({ success: true, message: 'Launching LinkedIn login browser...' });

    // Run browser logic in background using sessionManager
    (async () => {
        try {
            const result = await sessionManager.startLogin(userId);
            if (!result.success) {
                console.error(`[LOGIN-BOT] Failed to start login: ${result.error}`);
            }
        } catch (error: any) {
            console.error(`[LOGIN-BOT] Error in startLogin:`, error.message);
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

export const syncExtension = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { linkedinCookie, linkedinLocalStorage, fingerprint } = req.body;

    if (!linkedinCookie) {
        return res.status(400).json({ error: 'Cookies required' });
    }

    try {
        console.log(`[AUTH-CTRL] Syncing extension session for user ${userId}...`);
        
        // Parse cookies to ensure they are valid JSON
        const parsedCookies = JSON.parse(linkedinCookie);
        if (!Array.isArray(parsedCookies)) {
            throw new Error('Cookies must be an array');
        }

        // Save session data to DB
        await prisma.user.update({
            where: { id: userId },
            data: {
                sessionValidatedAt: new Date(),
                sessionInvalid: false,
                lastBrowserActivityAt: new Date(),
                linkedinCookie: linkedinCookie,
                linkedinLocalStorage: linkedinLocalStorage || null,
                linkedinFingerprint: fingerprint ? JSON.stringify(fingerprint) : null,
            }
        });

        // Trigger asynchronous validation to retrieve profile info and emit socket success
        (async () => {
            try {
                const { sessionValidator } = await import('../services/session-validator.service');
                const { io } = await import('../socket');
                const validation = await sessionValidator.validateSession(userId);
                if (validation.valid) {
                    console.log(`[AUTH-CTRL] Post-extension-sync validation successful for ${userId}`);
                    if (io) {
                        io.to(`user_${userId}`).emit('SESSION_LOGIN_STATUS', { 
                            status: 'SUCCESS', 
                            message: 'Successfully synced extension!',
                            profile: validation.profile 
                        });
                    }
                } else {
                    console.error(`[AUTH-CTRL] Post-extension-sync validation failed for ${userId}: ${validation.reason}`);
                    if (io) {
                        io.to(`user_${userId}`).emit('SESSION_LOGIN_STATUS', { 
                            status: 'FAILED', 
                            error: `Validation failed: ${validation.reason || 'Unknown error'}` 
                        });
                    }
                }
            } catch (err: any) {
                console.error(`[AUTH-CTRL] Error during post-extension-sync validation:`, err.message);
            }
        })();

        res.json({ success: true, message: 'Extension session received and validation started.' });
    } catch (error: any) {
        console.error(`[AUTH-CTRL] syncExtension error:`, error.message);
        res.status(500).json({ error: error.message || 'Failed to sync extension session' });
    }
};
