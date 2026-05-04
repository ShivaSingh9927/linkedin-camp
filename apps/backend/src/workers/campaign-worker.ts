/**
 * campaign-worker.ts
 * * Optimized to match the successful "Phase 2" browser strategy.
 * This worker pulls session data from Prisma and passes it to the engine.
 */

import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import Redis from 'ioredis';
import { runCampaign } from '../campaign-engine';
import { CampaignConfig } from '../campaign-engine/types';
import { getOrAssignProxy } from '../services/proxy.service';
import * as fs from 'fs';
import * as path from 'path';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

interface CampaignJobData {
    userId: string;
    campaignId: string;
}

const processCampaignJob = async (data: CampaignJobData, job: Job) => {
    const { userId, campaignId } = data;

    console.log(`\n[CAMPAIGN-WORKER] 🚀 Starting Campaign: ${campaignId}`);

    // 1. Fetch Campaign & Business Profile
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const businessProfile = await prisma.businessProfile.findUnique({ where: { userId } });

    if (!campaign || !businessProfile) {
        console.error(`[CAMPAIGN-WORKER] Missing critical data for campaign ${campaignId}`);
        return;
    }

    // 2. FETCH SESSION DATA (from User table)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || (!user.linkedinCookie && !user.persistentSessionPath && !user.sessionPath)) {
        throw new Error(`No active LinkedIn session found for user ${userId}. Run Phase 1 first.`);
    }

    // PRE-FLIGHT SESSION VALIDATION
    const { sessionValidator } = await import('../services/session-validator.service');
    const quickCheck = await sessionValidator.quickCheck(userId);
    
    if (!quickCheck.connected || quickCheck.sessionInvalid) {
        console.error(`[CAMPAIGN-WORKER] Session invalid for user ${userId}. Pausing campaign.`);
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' }
        });
        await prisma.notification.create({
            data: {
                userId,
                title: 'Session Expired',
                body: 'Your LinkedIn session has expired. Please re-login to resume campaigns.',
                type: 'ERROR',
            }
        });
        
        const { io } = await import('../socket');
        io.to(`user_${userId}`).emit('SESSION_EXPIRED', {
            userId,
            campaignId,
            message: 'LinkedIn session expired. Please re-login.',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // 3. PARSE CONFIG & INJECT STEALTH ARGS
    const rawConfig = campaign.workflowJson || campaign.workflow;
    const config: any = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
    
    // Convert React Flow graph (nodes/edges) into a linear flow array for the engine
    // Also handle plain array format: [{"type": "PROFILE_VISIT"}, {"type": "MESSAGE"}]
    if (config.nodes && config.edges && !config.flow) {
        const orderedNodes = [];
        let currentNodeId = config.nodes.find((n: any) => 
            n.type === 'TRIGGER' || 
            n.id === 'trigger' || 
            n.data?.subType === 'START' ||
            n.subType === 'START'
        )?.id;
        
        while (currentNodeId) {
            const edge = config.edges.find((e: any) => e.source === currentNodeId);
            if (!edge) break;
            
            currentNodeId = edge.target;
            const targetNode = config.nodes.find((n: any) => n.id === currentNodeId);
            if (targetNode) orderedNodes.push(targetNode);
        }

        console.log(`[CAMPAIGN-WORKER] Converting nodes to flow. orderedNodes length: ${orderedNodes.length}, orderedNodes:`, JSON.stringify(orderedNodes));
        
        config.flow = orderedNodes.map((node: any) => {
            const data = node.data || {};
            const rawSubType = (data.subType || node.subType || node.type || '').toUpperCase();
            let mappedNodeType = rawSubType;
            
            switch(rawSubType) {
                case 'VISIT':
                case 'PROFILE_VISIT':
                    mappedNodeType = 'profile-visit'; 
                    break;
                case 'MESSAGE': 
                    mappedNodeType = 'send-message'; break;
                case 'LIKE_NTH_POST':
                case 'LIKE_POST':
                case 'LIKE':
                    mappedNodeType = 'like-nth-post'; break;
                case 'COMMENT_NTH_POST':
                case 'COMMENT_POST':
                case 'COMMENT':
                    mappedNodeType = 'comment-nth-post'; break;
                case 'CONNECT': 
                    mappedNodeType = 'connect'; break;
                case 'DELAY': 
                    mappedNodeType = 'delay'; break;
                case 'WARMUP': 
                    mappedNodeType = 'warmup'; break;
                case 'INBOX_SYNC':
                    mappedNodeType = 'inbox-sync'; break;
            }

            return {
                ...data,
                node: mappedNodeType
            };
        });
    }

    // Also handle plain array format: [{"type": "PROFILE_VISIT"}, {"type": "MESSAGE"}]
    if (!config.flow && Array.isArray(config)) {
        config.flow = config.map((node: any) => {
            const rawSubType = (node.type || node.subType || '').toUpperCase();
            let mappedNodeType = rawSubType;
            
            switch(rawSubType) {
                case 'VISIT':
                case 'PROFILE_VISIT':
                    mappedNodeType = 'profile-visit'; 
                    break;
                case 'MESSAGE': 
                    mappedNodeType = 'send-message'; break;
                case 'LIKE_NTH_POST':
                case 'LIKE_POST':
                case 'LIKE':
                    mappedNodeType = 'like-nth-post'; break;
                case 'COMMENT_NTH_POST':
                case 'COMMENT_POST':
                case 'COMMENT':
                    mappedNodeType = 'comment-nth-post'; break;
                case 'CONNECT': 
                    mappedNodeType = 'connect'; break;
                case 'INMAIL':
                    mappedNodeType = 'inmail'; break;
                default:
                    mappedNodeType = node.type?.toLowerCase() || node.subType?.toLowerCase() || 'unknown';
            }
            
            return { ...node, node: mappedNodeType };
        });
        console.log(`[CAMPAIGN-WORKER] Converted plain array to flow:`, JSON.stringify(config.flow));
    }

    // Inject AI Context & Session Security
    config.campaignId = campaignId;
    config.objective = campaign.objective || undefined;
    config.persona = businessProfile.persona || undefined;

     // Build session context from database session files
    let parsedCookies = null;
    let parsedUserAgent = null;
    let parsedLocalStorage = null;

    try {
        if (user.linkedinCookie) {
            // Check if it's already a JSON string (array of cookies) or just the li_at value
            let raw;
            try {
                raw = JSON.parse(user.linkedinCookie);
                // It's JSON - could be array or object
            } catch (e) {
                // It's not JSON, treat as raw li_at cookie value
                raw = [{ name: 'li_at', value: user.linkedinCookie, domain: '.linkedin.com', path: '/' }];
            }
            
            // Normalize: ensure expires is a number (seconds), not string/ms
            parsedCookies = Array.isArray(raw) ? raw.map((c: any) => {
                // Ensure we have the basic cookie properties
                const cookie = {
                    ...c,
                    // Set default values if missing
                    domain: c.domain || '.linkedin.com',
                    path: c.path || '/',
                    // Ensure expires is a number (seconds)
                    expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                    // Handle sameSite values
                    sameSite: c.sameSite === 'no_restriction' || c.sameSite === 'none' ? 'None' : 
                             c.sameSite === 'unspecified' || c.sameSite === 'lax' ? 'Lax' : 
                             c.sameSite === 'strict' ? 'Strict' : 'Lax'
                };
                return cookie;
            }) : [raw]; // If raw is not an array, wrap it in one
        }
    } catch (e: any) {
        console.error(`[CAMPAIGN-WORKER] Cookie parse error: ${e.message}`);
        // Fallback: create a basic li_at cookie if parsing fails completely
        if (user.linkedinCookie) {
            parsedCookies = [{
                name: 'li_at',
                value: user.linkedinCookie,
                domain: '.linkedin.com',
                path: '/',
                expires: Math.round(Date.now() / 1000) + 86400 * 30, // 30 days from now
                sameSite: 'Lax'
            }];
        }
    }

    try {
        if (user.linkedinFingerprint) {
            const fp = typeof user.linkedinFingerprint === 'string'
                ? JSON.parse(user.linkedinFingerprint) : user.linkedinFingerprint;
            parsedUserAgent = fp?.userAgent || null;
        }
    } catch {}

    try {
        if (user.linkedinLocalStorage) {
            parsedLocalStorage = typeof user.linkedinLocalStorage === 'string'
                ? JSON.parse(user.linkedinLocalStorage) : user.linkedinLocalStorage;
        }
    } catch {}

    // FALLBACK: Load session from disk files (socket login)
    const sessionDir = user.persistentSessionPath || user.sessionPath;
    if (sessionDir && !parsedCookies) {
        try {
            const cookiesPath = path.join(sessionDir, 'cookies.json');
            if (fs.existsSync(cookiesPath)) {
                const rawCookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
                parsedCookies = Array.isArray(rawCookies) ? rawCookies.map((c: any) => ({
                    ...c,
                    domain: c.domain || '.linkedin.com',
                    path: c.path || '/',
                    expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                    sameSite: c.sameSite === 'no_restriction' || c.sameSite === 'none' ? 'None' :
                             c.sameSite === 'unspecified' || c.sameSite === 'lax' ? 'Lax' :
                             c.sameSite === 'strict' ? 'Strict' : 'Lax'
                })) : [rawCookies];
                console.log(`[CAMPAIGN-WORKER] Loaded ${parsedCookies.length} cookies from disk`);
            }
        } catch (e: any) {
            console.error(`[CAMPAIGN-WORKER] Failed to load cookies from disk: ${e.message}`);
        }
    }

    if (sessionDir && !parsedUserAgent) {
        try {
            const fpPath = path.join(sessionDir, 'fingerprint.json');
            if (fs.existsSync(fpPath)) {
                const fp = JSON.parse(fs.readFileSync(fpPath, 'utf-8'));
                parsedUserAgent = fp?.userAgent || null;
                console.log(`[CAMPAIGN-WORKER] Loaded userAgent from disk: ${!!parsedUserAgent}`);
            }
        } catch (e: any) {
            console.error(`[CAMPAIGN-WORKER] Failed to load fingerprint from disk: ${e.message}`);
        }
    }

    if (sessionDir && !parsedLocalStorage) {
        try {
            const lsPath = path.join(sessionDir, 'localStorage.json');
            if (fs.existsSync(lsPath)) {
                parsedLocalStorage = JSON.parse(fs.readFileSync(lsPath, 'utf-8'));
                console.log(`[CAMPAIGN-WORKER] Loaded ${Object.keys(parsedLocalStorage).length} localStorage keys from disk`);
            }
        } catch (e: any) {
            console.error(`[CAMPAIGN-WORKER] Failed to load localStorage from disk: ${e.message}`);
        }
    }

    // Get proxy via service instead of hardcoded
    const userProxy = await getOrAssignProxy(userId);
    let sessionProxy = null;
    if (userProxy) {
        sessionProxy = {
            server: `http://${userProxy.proxyHost}:${userProxy.proxyPort}`,
            username: userProxy.proxyUsername || undefined,
            password: userProxy.proxyPassword || undefined,
        };
    }

    config.sessionContext = {
        cookies: parsedCookies,
        userAgent: parsedUserAgent,
        localStorage: parsedLocalStorage,
        proxy: sessionProxy
    };

    console.log(`[CAMPAIGN-WORKER] Session ready — cookies: ${parsedCookies?.length || 0}, UA: ${parsedUserAgent ? 'yes' : 'no'}, localStorage keys: ${parsedLocalStorage ? Object.keys(parsedLocalStorage).length : 0}`);

    // 4. CHECK LEAD AVAILABILITY
    const readyLeadsCount = await prisma.campaignLead.count({
        where: {
            campaignId,
            isCompleted: false,
            nextActionDate: { lte: new Date() },
        },
    });

    if (readyLeadsCount === 0) {
        console.log(`[CAMPAIGN-WORKER] ⏸️ No leads ready for processing right now.`);
        return;
    }

    // 5. EXECUTION
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });

    try {
        // We pass the sessionContext directly so runCampaign can launch Playwright correctly
        const summary = await runCampaign(userId, campaignId, config);

        console.log(`[CAMPAIGN-WORKER] ✅ Campaign ${campaignId} finished.`);
        console.log(`   Stats -> Succeeded: ${summary.succeeded}, Failed: ${summary.failed}`);
        
    } catch (err: any) {
        console.error(`[CAMPAIGN-WORKER] ❌ Critical Crash:`, err.message);

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' },
        });

        await prisma.notification.create({
            data: {
                userId,
                title: 'Campaign Error',
                body: `Campaign "${campaign.name}" paused due to: ${err.message}`,
                type: 'ERROR',
            },
        });
    }
};

// ---- WORKER INITIALIZATION ----

export const initCampaignWorker = () => {
    console.log('[CAMPAIGN-WORKER] Attempting to initialize...');
    console.log('[CAMPAIGN-WORKER] Redis URL from env:', process.env.REDIS_URL);
    console.log('[CAMPAIGN-WORKER] Fallback REDIS_URL constant:', REDIS_URL);
    
    if (!redisConnection) {
        console.log('[CAMPAIGN-WORKER] ❌ No Redis connection - worker NOT started');
        console.log('[CAMPAIGN-WORKER] ❌ Redis URL was:', REDIS_URL);
        return;
    }

    console.log('[CAMPAIGN-WORKER] ✅ Redis connection exists, creating worker...');
    console.log('[CAMPAIGN-WORKER] Queue name: campaign-actions');
    
    const worker = new Worker('campaign-actions', async (job: Job) => {
        console.log('[CAMPAIGN-WORKER] 📥 Received job:', job.id, job.data);
        await processCampaignJob(job.data as CampaignJobData, job);
    }, {
        connection: redisConnection as any,
        concurrency: 1, // Stay safe: One campaign at a time to avoid IP flags
    });

    worker.on('failed', (job, err) => {
        console.error(`[CAMPAIGN-WORKER] Job ${job?.id} failed:`, err.message);
    });

    worker.on('completed', (job) => {
        console.log(`[CAMPAIGN-WORKER] Job ${job?.id} completed!`);
    });

    worker.on('progress', (job, progress) => {
        console.log(`[CAMPAIGN-WORKER] Job ${job?.id} progress:`, progress);
    });

    console.log('[CAMPAIGN-WORKER] 🛰️ Listening on queue: campaign-actions');
    return worker;
};

// ---- QUEUE HELPERS ----

export const getCampaignQueue = () => {
    if (!redisConnection) return null;
    return new Queue('campaign-actions', { connection: redisConnection as any });
};

export const enqueueCampaign = async (userId: string, campaignId: string, delayMs = 0) => {
    const queue = getCampaignQueue();
    if (!queue) return;

    await queue.add(`campaign-${campaignId}`, { userId, campaignId }, {
        delay: delayMs,
        removeOnComplete: true,
        attempts: 1, // Don't auto-retry LinkedIn actions to prevent bans
    });

    console.log(`[CAMPAIGN-WORKER] 📥 Enqueued ${campaignId}`);
};