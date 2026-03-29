import { chromium } from 'playwright-extra';
import { prisma } from '@repo/db';

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

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

// ---- Node registry ----

const NODE_HANDLERS: Record<NodeType, NodeHandler> = {
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
    flow: CampaignFlowNode[]
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

        // ---- Build browser context ----
        let userAgentStr = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
        let viewportSettings = { width: 1440, height: 900 };

        // Read fingerprint from DB (synced by extension)
        if (user.linkedinFingerprint) {
            try {
                const fp = typeof user.linkedinFingerprint === 'string'
                    ? JSON.parse(user.linkedinFingerprint)
                    : user.linkedinFingerprint;
                if (fp.userAgent) userAgentStr = fp.userAgent;
                if (fp.screen?.width && fp.screen?.height) {
                    viewportSettings = { width: fp.screen.width, height: fp.screen.height };
                }
            } catch {}
        }

        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--start-maximized',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
        };

        const contextOptions: any = {
            userAgent: userAgentStr,
            viewport: viewportSettings,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata',
        };

        if (user.proxy) {
            contextOptions.proxy = {
                server: `http://${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined,
            };
        } else {
            contextOptions.proxy = {
                server: 'http://disp.oxylabs.io:8001',
                username: 'user-shivasingh_clgdY',
                password: 'Iamironman_3',
            };
        }

        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(contextOptions);

        // Inject cookies from DB
        if (user.linkedinCookie) {
            try {
                const cookies = JSON.parse(user.linkedinCookie);
                if (Array.isArray(cookies)) {
                    const sanitized = cookies.map((c: any) => ({
                        ...c,
                        expires: c.expires ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                    }));
                    await context.addCookies(sanitized);
                }
            } catch {}
        }

        // Inject localStorage
        if (user.linkedinLocalStorage) {
            try {
                const lsData = JSON.parse(user.linkedinLocalStorage);
                await context.addInitScript((data: any) => {
                    const parsed = JSON.parse(data);
                    for (const [k, v] of Object.entries(parsed)) {
                        window.localStorage.setItem(k, v as string);
                    }
                }, JSON.stringify(lsData));
            } catch {}
        }

        page = context.pages()[0] || await context.newPage();
        await blockResources(page);

        // ---- Load previously stored outputs ----
        const storedOutputs = await readNodeOutputs(campaignId, lead.id);

        // ---- Execute flow ----
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
                    console.log(`[ENGINE] Lead ${lead.firstName}: warmup FAILED. Skipping to next lead.`);
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

        const result = await runLead(userId, campaignId, leadData, config.flow);
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
