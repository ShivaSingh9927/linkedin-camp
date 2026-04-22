import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

import { prisma } from '@repo/db';
import * as fs from 'fs';
import * as path from 'path';

import {
    CampaignConfig,
    CampaignFlowNode,
    NodeContext,
    NodeExecution,
    NodeHandler,
    NodeResult,
    LeadExecutionResult,
    CampaignSummary,
    NodeType,
    SessionContext,
} from './types';
import { warmup } from './nodes/warmup';
import { profileVisit } from './nodes/profile-visit';
import { connect } from './nodes/connect';
import { likeNthPost } from './nodes/like-nth-post';
import { commentNthPost } from './nodes/comment-nth-post';
import { sendMessage } from './nodes/send-message';
import { inboxSync } from './nodes/inbox-sync';
import { delay } from './nodes/delay';
import { readNodeOutputs, writeNodeOutput, updateLeadEnrichment } from './storage';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

// ---- File-based session loading (like testscripts) ----

interface SessionFiles {
    cookies: any[];
    userAgent: string;
    localStorage: Record<string, string>;
}

function loadSessionFromFiles(userId?: string, basePath?: string): SessionFiles | null {
    // Look in multiple locations for session files
    // Priority: 1) sessions/{userId}/  2) testscripts/  3) custom basePath
    const possiblePaths: string[] = [];
    
    if (userId) {
        possiblePaths.push(`/app/sessions/${userId}`);
        possiblePaths.push(path.join(__dirname, `../../sessions/${userId}`));
        possiblePaths.push(path.join(__dirname, `../../../sessions/${userId}`));
    }
    
    possiblePaths.push('/app/testscripts');
    possiblePaths.push(path.join(__dirname, '../../testscripts'));
    possiblePaths.push(path.join(__dirname, '../../../testscripts'));
    
    if (basePath) {
        possiblePaths.unshift(basePath);
    }
    
    let base: string | null = null;
    for (const p of possiblePaths) {
        const cookiesPath = path.join(p, 'cookies.json');
        const fingerprintPath = path.join(p, 'fingerprint.json');
        if (fs.existsSync(cookiesPath) && fs.existsSync(fingerprintPath)) {
            base = p;
            break;
        }
    }
    
    if (!base) {
        console.log('[ENGINE] Session files not found in any location');
        return null;
    }
    
    try {
        const cookiesPath = path.join(base, 'cookies.json');
        const fingerprintPath = path.join(base, 'fingerprint.json');
        const localStoragePath = path.join(base, 'localStorage.json');
        
        if (!fs.existsSync(cookiesPath) || !fs.existsSync(fingerprintPath)) {
            console.log(`[ENGINE] Session files not found at ${base}`);
            return null;
        }
        
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
        const fingerprint = JSON.parse(fs.readFileSync(fingerprintPath, 'utf-8'));
        
        let localStorage: Record<string, string> = {};
        if (fs.existsSync(localStoragePath)) {
            try {
                localStorage = JSON.parse(fs.readFileSync(localStoragePath, 'utf-8'));
            } catch {}
        }
        
        console.log(`[ENGINE] Loaded session from files: ${cookies.length} cookies`);
        console.log(`[ENGINE] UserAgent: ${fingerprint.userAgent}`);
        
        return {
            cookies,
            userAgent: fingerprint.userAgent,
            localStorage,
        };
    } catch (err: any) {
        console.log(`[ENGINE] Failed to load session files: ${err.message}`);
        return null;
    }
}

// ---- Node registry ----

const NODE_HANDLERS: Record<NodeType, NodeHandler> = {
    'warmup': warmup,
    'profile-visit': profileVisit,
    'connect': connect,
    'like-nth-post': likeNthPost,
    'comment-nth-post': commentNthPost,
    'send-message': sendMessage,
    'delay': delay,
    'inbox-sync': inboxSync,
};

// Nodes that are fatal if they fail (skip to next lead)
const FATAL_NODES: Set<string> = new Set(['profile-visit']);

// ---- Block resources for speed ----

async function blockResources(page: any) {
    await page.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        const url = route.request().url();
        if (
            ['image', 'media', 'font'].includes(type) ||
            url.includes('analytics') ||
            url.includes('ads') ||
            url.includes('tracking') ||
            url.includes('doubleclick')
        ) {
            return route.abort();
        }
        return route.continue();
    });
}

// ---- Run campaign for a single lead ----

async function runLead(
    userId: string,
    campaignId: string,
    lead: { id: string; linkedinUrl: string; firstName: string | null; lastName: string | null },
    flow: CampaignFlowNode[],
    campaignData?: {
        objective?: string;
        cta?: string;
        toneOverride?: string;
        persona?: string;
        valueProp?: string;
    },
    sessionContext?: SessionContext
): Promise<LeadExecutionResult> {
    const execResult: LeadExecutionResult = {
        leadId: lead.id,
        leadName: lead.firstName || lead.linkedinUrl,
        status: 'failed',
        nodesExecuted: [],
    };

    let browser: any;
    let context: any;
    let page: any;

    try {
        // ---- Load user session data ----
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { proxy: true },
        });

        if (!user) {
            execResult.failedAt = 'init';
            execResult.nodesExecuted.push({
                node: 'profile-visit' as NodeType,
                status: 'failed',
                error: 'User not found',
                at: new Date().toISOString(),
            });
            return execResult;
        }

        // ---- Build browser context (matching phase2_cookie_message.js strategy) ----

        const launchOptions: any = {
            headless: true,
            executablePath: '/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--start-maximized',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
        };

        // Determine session source: files > worker-provided context > DB
        // File-based session (testscripts/phase1) is the proven working source.
        // DB cookies can be overwritten by extension sync with stale data.
        let activeCookies: any[] | null = null;
        let activeUserAgent: string | null = null;
        let activeLocalStorage: Record<string, string> | null = null;
        let activeProxy: { server: string; username?: string; password?: string } | null = null;

        // Always take proxy from worker context if available
        if (sessionContext?.proxy) {
            activeProxy = sessionContext.proxy;
        }

        // PRIMARY: Try file-based session (like testscripts) — proven working
        const sessionFiles = loadSessionFromFiles(userId);
        if (sessionFiles) {
            console.log(`[ENGINE] Using session from FILES (${sessionFiles.cookies.length} cookies) — proven working source`);
            activeCookies = sessionFiles.cookies;
            activeUserAgent = sessionFiles.userAgent;
            activeLocalStorage = sessionFiles.localStorage;
        } else if (sessionContext?.cookies) {
            // FALLBACK 1: Session from worker (parsed from DB by campaign-worker)
            console.log(`[ENGINE] Using session from worker context (${sessionContext.cookies.length} cookies)`);
            activeCookies = sessionContext.cookies;
            activeUserAgent = sessionContext.userAgent;
            activeLocalStorage = sessionContext.localStorage;
            if (!activeProxy) activeProxy = sessionContext.proxy;
        } else {
            // LAST RESORT: Parse from DB directly
            console.log('[ENGINE] No files or worker context. Falling back to DB session.');
            try {
                if (user.linkedinCookie) {
                    const raw = JSON.parse(user.linkedinCookie);
                    activeCookies = Array.isArray(raw) ? raw.map((c: any) => ({
                        ...c,
                        expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                    })) : raw;
                }
            } catch {}
            try {
                if (user.linkedinFingerprint) {
                    const fp = typeof user.linkedinFingerprint === 'string'
                        ? JSON.parse(user.linkedinFingerprint) : user.linkedinFingerprint;
                    activeUserAgent = fp?.userAgent || null;
                }
            } catch {}
            try {
                if (user.linkedinLocalStorage) {
                    activeLocalStorage = typeof user.linkedinLocalStorage === 'string'
                        ? JSON.parse(user.linkedinLocalStorage) : user.linkedinLocalStorage;
                }
            } catch {}
        }

        const contextOptions: any = {
            userAgent: activeUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
            viewport: null,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata',
        };

        // Proxy: prefer worker-provided, then DB, then default
        if (activeProxy) {
            contextOptions.proxy = activeProxy;
        } else if (user.proxy) {
            contextOptions.proxy = {
                server: `http://${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined,
            };
        } else {
            contextOptions.proxy = {
                server: 'http://82.41.252.111:46222',
                username: 'xBVyYdUpx84nWx7',
                password: 'dwwTxtvv5a10RXn',
            };
        }

        console.log(`[ENGINE] Proxy: ${contextOptions.proxy.server} | UA: ${contextOptions.userAgent.slice(0, 60)}...`);

        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(contextOptions);

        // Inject cookies (exactly like phase2_cookie_message.js line 62)
        if (activeCookies && activeCookies.length > 0) {
            await context.addCookies(activeCookies);
            const verify = await context.cookies();
            console.log(`[ENGINE] Injected ${activeCookies.length} cookies, verified ${verify.length} in context`);
        } else {
            console.warn('[ENGINE] ⚠️ No cookies available — session will likely fail');
        }

        // Inject localStorage (exactly like phase2_cookie_message.js lines 68-75)
        if (activeLocalStorage && Object.keys(activeLocalStorage).length > 0) {
            await context.addInitScript((data: any) => {
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) {
                    window.localStorage.setItem(k, v as string);
                }
            }, JSON.stringify(activeLocalStorage));
            console.log(`[ENGINE] Injected ${Object.keys(activeLocalStorage).length} localStorage keys`);
        }

        page = context.pages()[0] || await context.newPage();
        // NOTE: Resource blocking disabled to match working testscript behavior.
        // LinkedIn's messaging components require full JS/CSS loading.
        // await blockResources(page);

        // ---- Load previously stored outputs ----
        const storedOutputs = await readNodeOutputs(campaignId, lead.id);

        // ---- Execute flow ----
        console.log(`[ENGINE] Flow received: ${JSON.stringify(flow)}`);
        console.log(`[ENGINE] Flow length: ${flow?.length}`);
        
        let needsWarmup = true; // First node always needs warmup
        let profileVisitRan = false;

        for (let i = 0; i < flow.length; i++) {
            const nodeConfig = flow[i];
            const nodeType = nodeConfig.node;

            // Auto warmup rules
            if (needsWarmup && nodeType !== 'delay') {
                const warmupExec: NodeExecution = {
                    node: 'warmup' as NodeType,
                    status: 'success',
                    at: new Date().toISOString(),
                };

                const warmupCtx: NodeContext = {
                    page, context, lead, userId, campaignId, storedOutputs,
                };

                const warmupResult = await warmup(warmupCtx, { node: 'warmup' });

                if (!warmupResult.success) {
                    // Warmup is fatal
                    warmupExec.status = 'failed';
                    warmupExec.error = warmupResult.error;
                    execResult.nodesExecuted.push(warmupExec);
                    execResult.status = 'failed';
                    execResult.failedAt = 'warmup';
                    console.log(`[ENGINE] Lead ${lead.firstName}: warmup FAILED. Error: ${warmupResult.error}. Skipping to next lead.`);
                    return execResult;
                }

                warmupExec.output = warmupResult.output;
                execResult.nodesExecuted.push(warmupExec);
                needsWarmup = false;
            }

            // Execute the node
            const nodeExec: NodeExecution = {
                node: nodeType,
                status: 'success',
                at: new Date().toISOString(),
            };

            const nodeCtx: NodeContext = {
                page, context, lead, userId, campaignId, storedOutputs,
                campaign: campaignData,
            };

            console.log(`[ENGINE] Lead ${lead.firstName}: executing node ${i + 1}/${flow.length} → ${nodeType}`);

            const handler = NODE_HANDLERS[nodeType];
            if (!handler) {
                nodeExec.status = 'failed';
                nodeExec.error = `Unknown node type: ${nodeType}`;
                execResult.nodesExecuted.push(nodeExec);
                continue;
            }

            const result: NodeResult = await handler(nodeCtx, nodeConfig);

            if (result.success) {
                nodeExec.output = result.output;
                execResult.nodesExecuted.push(nodeExec);

                // Store output for downstream nodes
                if (result.output) {
                    storedOutputs[nodeType] = result.output;
                    await writeNodeOutput(campaignId, lead.id, nodeExec);
                }

                // If profile-visit, update lead enrichment
                if (nodeType === 'profile-visit' && result.output) {
                    profileVisitRan = true;
                    await updateLeadEnrichment(lead.id, result.output);
                }

                // If connect sent, update lead status
                if (nodeType === 'connect' && result.output?.status === 'sent') {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { status: 'PENDING' },
                    }).catch(() => {});
                }

            } else {
                nodeExec.status = 'failed';
                nodeExec.error = result.error;
                execResult.nodesExecuted.push(nodeExec);

                // Write the failed execution too
                await writeNodeOutput(campaignId, lead.id, nodeExec).catch(() => {});

                // Check if fatal
                if (FATAL_NODES.has(nodeType)) {
                    execResult.status = 'failed';
                    execResult.failedAt = nodeType;
                    console.log(`[ENGINE] Lead ${lead.firstName}: ${nodeType} FAILED (fatal). Skipping to next lead.`);
                    return execResult;
                }

                console.log(`[ENGINE] Lead ${lead.firstName}: ${nodeType} FAILED (non-fatal). Continuing to next node.`);
            }

            // If delay node, set warmup needed for next node
            if (nodeType === 'delay') {
                needsWarmup = true;
            }

            // Safety gap between nodes
            if (i < flow.length - 1 && flow[i + 1]?.node !== 'delay') {
                await wait(randomRange(3000, 8000));
            }
        }

        execResult.status = 'completed';
        return execResult;

    } catch (err: any) {
        execResult.status = 'failed';
        execResult.failedAt = 'unknown';
        execResult.nodesExecuted.push({
            node: 'profile-visit' as NodeType,
            status: 'failed',
            error: err.message,
            at: new Date().toISOString(),
        });
        return execResult;

    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

// ---- Run full campaign ----

export async function runCampaign(
    userId: string,
    campaignId: string,
    config: CampaignConfig
): Promise<CampaignSummary> {
    const startedAt = new Date().toISOString();

    console.log(`\n${'='.repeat(50)}`);
    console.log(`[CAMPAIGN] Starting campaign ${campaignId}`);
    console.log(`${'='.repeat(50)}\n`);

    // Get all leads for this campaign
    const campaignLeads = await prisma.campaignLead.findMany({
        where: { campaignId, isCompleted: false },
        include: { lead: true },
    });

    const summary: CampaignSummary = {
        campaignId,
        totalLeads: campaignLeads.length,
        succeeded: 0,
        failed: 0,
        leadResults: [],
        startedAt,
        completedAt: '',
    };

    for (const cl of campaignLeads) {
        const leadData = {
            id: cl.lead.id,
            linkedinUrl: cl.lead.linkedinUrl,
            firstName: cl.lead.firstName,
            lastName: cl.lead.lastName,
        };

        console.log(`\n[CAMPAIGN] Processing lead: ${leadData.firstName || leadData.linkedinUrl}`);

        const result = await runLead(userId, campaignId, leadData, config.flow, {
            objective: config.objective,
            cta: config.cta,
            toneOverride: config.toneOverride,
            persona: config.persona,
            valueProp: config.valueProp,
        }, config.sessionContext);
        summary.leadResults.push(result);

        if (result.status === 'completed') {
            summary.succeeded++;
            await prisma.campaignLead.update({
                where: { id: cl.id },
                data: { isCompleted: true, lastActionAt: new Date() },
            }).catch(() => {});
        } else {
            summary.failed++;
        }

        // Gap between leads
        await wait(randomRange(10000, 20000));
    }

    summary.completedAt = new Date().toISOString();

    // ---- Print summary ----
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[CAMPAIGN] SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Total Leads:  ${summary.totalLeads}`);
    console.log(`Succeeded:    ${summary.succeeded}`);
    console.log(`Failed:       ${summary.failed}`);
    console.log('');

    for (const lr of summary.leadResults) {
        const icon = lr.status === 'completed' ? '✅' : '❌';
        const nodes = lr.nodesExecuted
            .map(n => {
                const nIcon = n.status === 'success' ? '✅' : '❌';
                return `${n.node}${nIcon}`;
            })
            .join(' → ');
        console.log(`${icon} ${lr.leadName}: ${nodes}`);

        // Print errors
        for (const n of lr.nodesExecuted) {
            if (n.status === 'failed') {
                console.log(`   [${n.node}] ${n.error}`);
            }
        }
    }

    console.log(`${'='.repeat(50)}\n`);

    // Mark campaign as completed if all leads done
    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
    }).catch(() => {});

    return summary;
}
