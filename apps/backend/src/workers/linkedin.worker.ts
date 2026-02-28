import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { chromium } from 'playwright-extra';
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
import { prisma } from '../server';
import { ActionType, WorkflowJson } from '@repo/types';

chromium.use(stealthPlugin());

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

const randomDelay = (min = 2000, max = 5000) =>
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

export const initWorker = () => {
    const worker = new Worker('linkedin-actions', async (job: Job) => {
        const { campaignLeadId, userId, leadId, currentStepId, workflowJson } = job.data as any;
        const workflow = workflowJson as WorkflowJson;

        console.log(`Executing step ${currentStepId} for lead ${leadId}`);

        // 1. Find the current node in the workflow
        const currentNode = workflow.nodes.find(n => n.id === currentStepId);
        if (!currentNode) return;

        // 2. Execute the action if it's an ACTION node
        if (currentNode.type === 'ACTION') {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });

            // MOCK MODE: If no cookies, we just log and succeed for testing
            if (!user?.linkedinCookie || process.env.MOCK_PLAYWRIGHT === 'true') {
                console.log(`[MOCK MODE] Executing ${currentNode.subType} for ${lead?.firstName} ${lead?.lastName}`);
                await randomDelay(500, 1000);
                await prisma.actionLog.create({
                    data: { userId, leadId, actionType: currentNode.subType as ActionType, status: 'SUCCESS' }
                });
            } else {
                if (!lead?.linkedinUrl) throw new Error('Missing lead data');

                const browser = await chromium.launch({ headless: true });
                const context = await browser.newContext({
                    viewport: { width: 1280, height: 720 },
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                });

                await context.addCookies([{
                    name: 'li_at',
                    value: user.linkedinCookie,
                    domain: '.linkedin.com',
                    path: '/',
                    httpOnly: true,
                    secure: true
                }]);

                const page = await context.newPage();

                try {
                    if (currentNode.subType === 'PROFILE_VISIT') {
                        await page.goto(lead.linkedinUrl, { waitUntil: 'networkidle' });
                        await randomDelay(3000, 6000);
                        await page.evaluate(() => window.scrollBy(0, 500));

                        await prisma.actionLog.create({
                            data: { userId, leadId, actionType: 'PROFILE_VISIT', status: 'SUCCESS' }
                        });
                    } else if (currentNode.subType === 'INVITE') {
                        await page.goto(lead.linkedinUrl, { waitUntil: 'networkidle' });
                        await randomDelay(3000, 6000);

                        // Look for connect button
                        const connectButton = page.getByRole('button', { name: 'Connect', exact: true }).first();
                        if (await connectButton.isVisible()) {
                            await connectButton.click();
                            await randomDelay(1000, 3000);

                            // Check for "Add a note"
                            const addNoteButton = page.getByRole('button', { name: 'Add a note', exact: true });
                            if (await addNoteButton.isVisible()) {
                                await addNoteButton.click();
                                await randomDelay(1000, 2000);

                                if (currentNode.data?.message) {
                                    await page.locator('#custom-message').fill(currentNode.data.message);
                                    await randomDelay(1000, 2000);
                                }
                            }

                            const sendButton = page.getByRole('button', { name: 'Send', exact: true });
                            await sendButton.click();
                            await randomDelay(2000, 4000);

                            await prisma.actionLog.create({
                                data: { userId, leadId, actionType: 'INVITE', status: 'SUCCESS' }
                            });
                        } else {
                            throw new Error('Connect button not visible');
                        }
                    } else if (currentNode.subType === 'MESSAGE') {
                        await page.goto(lead.linkedinUrl, { waitUntil: 'networkidle' });
                        await randomDelay(2000, 4000);

                        const messageButton = page.getByRole('button', { name: 'Message', exact: true }).first();
                        if (await messageButton.isVisible()) {
                            await messageButton.click();
                            await randomDelay(2000, 3000);

                            const textBox = page.locator('.msg-form__contenteditable');
                            await textBox.fill(currentNode.data?.message || 'Hi!');
                            await randomDelay(1000, 2000);

                            await page.keyboard.press('Control+Enter');
                            await randomDelay(2000, 4000);

                            await prisma.actionLog.create({
                                data: { userId, leadId, actionType: 'MESSAGE', status: 'SUCCESS' }
                            });
                        } else {
                            throw new Error('Message button not found');
                        }
                    }
                } catch (error: any) {
                    await prisma.actionLog.create({
                        data: { userId, leadId, actionType: currentNode.subType as ActionType, status: 'FAILED', errorMessage: error.message }
                    });
                    throw error;
                } finally {
                    await browser.close();
                }
            }
        }

        // 3. Find next step
        const nextEdge = workflow.edges.find(e => e.source === currentStepId);

        if (nextEdge) {
            const nextNode = workflow.nodes.find(n => n.id === nextEdge.target);
            let nextActionDate = new Date();

            // Handle DELAY node specifically
            if (nextNode?.type === 'DELAY') {
                const waitHours = 24; // Default wait or parse from node data
                nextActionDate = new Date(Date.now() + (waitHours * 60 * 60 * 1000));
                console.log(`Setting delay for ${waitHours}h until ${nextActionDate.toISOString()}`);
            }

            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: {
                    currentStepId: nextEdge.target,
                    nextActionDate,
                }
            });
        } else {
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { isCompleted: true }
            });
        }

    }, { connection: redisConnection as any });

    worker.on('completed', job => console.log(`Job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed: ${err.message}`));
};
