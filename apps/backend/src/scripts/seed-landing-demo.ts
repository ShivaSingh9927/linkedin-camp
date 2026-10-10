// Seeds (or removes) the fictional account used to capture the product
// screenshots on qampi.com (apps/landing/public/screens). Driven by
// apps/landing/scripts/capture-screens.mjs; run it LOCALLY only.
//
//   npx ts-node --transpile-only src/scripts/seed-landing-demo.ts seed
//   npx ts-node --transpile-only src/scripts/seed-landing-demo.ts token
//   npx ts-node --transpile-only src/scripts/seed-landing-demo.ts campaign-directions
//   npx ts-node --transpile-only src/scripts/seed-landing-demo.ts cleanup
//
// It only ever touches the throwaway `qampi_landing_demo` database (created
// with `prisma db push`), never the real local or prod DB, and refuses to run
// against anything else.
//
// Safety: the account has a placeholder linkedinCookie (so the app renders
// as "connected") but no real session or proxy. Never run worker-entry.ts
// while it exists: the capture script always ends with `cleanup`.
import { prisma } from '@repo/db';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { coldInvite, warmDM } from '../campaign-templates/shapes';
import { DEMO_LEADS } from './landing-demo-data';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const USER_ID = 'landing-demo-user';
const EMAIL = 'maya@relaypoint.example';
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600_000);

async function cleanup() {
    // Every demo row hangs off the user with onDelete: Cascade.
    await prisma.user.deleteMany({ where: { id: USER_ID } });
}

async function seed() {
    await cleanup();

    await prisma.user.create({
        data: {
            id: USER_ID,
            email: EMAIL,
            firstName: 'Maya',
            lastName: 'Collins',
            registrationStep: 'COMPLETED',
            tier: 'PRO',
            linkedinCookie: 'landing-demo-placeholder',
            sessionInvalid: false,
            accountHealth: 'HEALTHY',
            // Far-future stamp: /auth/linkedin-status trusts a fresh validation
            // and skips the live Voyager probe a placeholder cookie would fail.
            sessionValidatedAt: new Date('2099-01-01'),
            hubspotToken: 'landing-demo-placeholder',
            BusinessProfile: {
                create: {
                    name: 'Maya Collins',
                    company: 'Relaypoint',
                    persona: 'Founder',
                    industry: 'B2B SaaS',
                    companyDescription: 'Relaypoint gives revenue teams one live view of pipeline health across CRM, calls and email.',
                    products: 'Pipeline analytics, deal-risk alerts, forecast reviews',
                    differentiators: 'Set up in a day; no RevOps team needed',
                    targetAudience: 'Sales leaders at 20–200 person B2B SaaS companies',
                    mainPainPoint: 'Forecasts built on stale CRM data',
                    valueProp: 'Catch slipping deals two weeks earlier',
                    keywords: ['pipeline', 'forecasting', 'revops'],
                    aiStrategy: {
                        summary: 'Lead with forecast accuracy for scaling sales teams; reference hiring and funding moments.',
                        pillars: ['Forecast accuracy', 'Deal risk', 'Rep coaching'],
                    },
                    aiStrategyGeneratedAt: ago(20),
                    strategyConfirmedAt: ago(19),
                },
            },
            EmailAccount: {
                create: { provider: 'google', fromEmail: 'maya@relaypoint.example', fromName: 'Maya Collins' },
            },
        },
    });

    // Conversation timing per connected lead (index < 9): when the AI opener
    // went out and how long the lead took to reply (if they did).
    const REPLY_HOURS: Record<string, number> = { Sarah: 5, Daniel: 20, Priya: 2, Marcus: 30 };
    const openerSentAt = (i: number) => ago((i % 4) + 1, i * 2);
    const lastActivity = (i: number, first: string) =>
        new Date(openerSentAt(i).getTime() + (REPLY_HOURS[first] ?? 0) * 3600_000);

    // /leads has no ORDER BY, so the prospects table shows rows in insertion
    // order: insert one at a time, most engaged first, and never update them
    // afterwards (an UPDATE moves the row to the end of the heap).
    const leads = [];
    for (const [i, l] of DEMO_LEADS.entries()) {
        leads.push(
            await prisma.lead.create({
                data: {
                    userId: USER_ID,
                    linkedinUrl: `https://www.linkedin.com/in/qampi-demo-${l.first}-${l.last}`.toLowerCase(),
                    firstName: l.first,
                    lastName: l.last,
                    jobTitle: l.title,
                    headline: `${l.title} at ${l.company}`,
                    company: l.company,
                    location: l.location,
                    country: l.country,
                    email: l.email,
                    tags: l.tags,
                    latestPost: l.latestPost,
                    connectionDegree: i < 9 ? 1 : 2,
                    status: i < 4 ? 'REPLIED' : i < 9 ? 'CONNECTED' : i < 15 ? 'PENDING' : 'IMPORTED',
                    enrichedAt: i < 18 ? ago(3) : null,
                    createdAt: ago(0, 1 + i * 3),
                    // Inbox orders conversations by Lead.updatedAt.
                    updatedAt: i < 9 ? lastActivity(i, l.first) : ago(0, 1 + i * 3),
                },
            }),
        );
    }

    const cold = coldInvite({ beforeConnectDays: 1, afterAcceptDays: 2, betweenMsgsDays: 4, messageCount: 2 });
    const warm = warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 });

    const main = await prisma.campaign.create({
        data: {
            userId: USER_ID,
            name: 'Sales leaders — Series A SaaS',
            status: 'ACTIVE',
            objective: 'Book intro calls',
            description: 'Sales leaders at recently funded SaaS companies who are scaling their teams.',
            cta: 'a 15-minute call',
            workflowJson: cold as any,
            createdAt: ago(1),
        },
    });
    await prisma.campaign.create({
        data: { userId: USER_ID, name: 'Founder network warm-up', status: 'QUEUED', queuePosition: 1, workflowJson: warm as any, createdAt: ago(6) },
    });
    await prisma.campaign.create({
        data: { userId: USER_ID, name: 'Recruiter outreach — Q3', status: 'COMPLETED', workflowJson: cold as any, createdAt: ago(60) },
    });
    await prisma.campaign.create({
        data: { userId: USER_ID, name: 'Event follow-ups', status: 'DRAFT', workflowJson: warm as any, createdAt: ago(1) },
    });

    // The active campaign holds the first 18 leads at different stages.
    const nodeCount = (cold as any).nodes.length;
    const inCampaign = leads.slice(0, 18);
    for (const [i, lead] of inCampaign.entries()) {
        const replied = i < 4;
        const connected = i < 9;
        const invited = i < 15;
        await prisma.campaignLead.create({
            data: {
                campaignId: main.id,
                leadId: lead.id,
                status: replied ? 'REPLIED' : connected ? 'CONNECTED' : invited ? 'PENDING' : 'IMPORTED',
                isCompleted: replied,
                lastActionAt: ago(i % 5, i),
                nextActionDate: replied ? null : new Date(Date.now() + ((i % 3) + 1) * 3600_000),
            },
        });
        await prisma.campaignLeadProgress.create({
            data: {
                campaignId: main.id,
                leadId: lead.id,
                connectionStatus: connected ? 'connected' : invited ? 'pending' : 'not_connected',
                currentNodeIndex: replied ? nodeCount - 1 : connected ? 7 : invited ? 4 : 1,
                status: replied ? 'REPLIED' : 'IN_PROGRESS',
                completedAt: replied ? ago(i) : null,
            },
        });
    }

    // Action history over the last week, in both casings the app reads:
    // the engine's node types (campaign funnel) and the dashboard's.
    const logs: { leadId: string; actionType: string; executedAt: Date }[] = [];
    for (const [i, lead] of inCampaign.entries()) {
        const d = 7 - (i % 7);
        logs.push({ leadId: lead.id, actionType: 'profile-visit', executedAt: ago(d, 3) });
        logs.push({ leadId: lead.id, actionType: 'VISIT', executedAt: ago(d, 3) });
        if (i < 15) {
            logs.push({ leadId: lead.id, actionType: 'connect', executedAt: ago(d - 1 > 0 ? d - 1 : 0, 2) });
            logs.push({ leadId: lead.id, actionType: 'INVITE', executedAt: ago(d - 1 > 0 ? d - 1 : 0, 2) });
        }
        if (i < 9) {
            logs.push({ leadId: lead.id, actionType: 'connect-accept', executedAt: ago(Math.max(d - 2, 0), 1) });
            logs.push({ leadId: lead.id, actionType: 'send-message', executedAt: ago(Math.max(d - 3, 0), 1) });
            logs.push({ leadId: lead.id, actionType: 'MESSAGE', executedAt: ago(Math.max(d - 3, 0), 1) });
        }
    }
    await prisma.actionLog.createMany({
        data: logs.map((l) => ({ ...l, userId: USER_ID, campaignId: main.id, status: 'SUCCESS' })),
    });

    // Conversations: an AI-written opener per connected lead, and replies
    // from the first four.
    const opener: Record<string, { text: string; why: string }> = {
        Sarah: {
            text: "Hi Sarah, congrats on doubling the SDR team. Your point that hiring well is the hardest part of scaling sales stuck with me. When a team doubles, the forecast usually gets noisier before it gets better. We help sales leaders spot slipping deals about two weeks earlier. Worth a 15-minute look?",
            why: 'Their recent post about doubling the SDR team · Your pillar: forecast accuracy · Step 1 of 2',
        },
        Daniel: {
            text: "Hi Daniel, congrats on closing the Series A. The next 12 months usually mean a bigger sales team and a board that wants a forecast it can trust. That's exactly what Relaypoint does. Happy to show you how other post-A founders set it up in a day.",
            why: 'Recent Series A announcement · Role: founder & CEO · Your pillar: forecast accuracy',
        },
        Priya: {
            text: "Hi Priya, \"Outbound is not dead. Lazy outbound is.\" Couldn't agree more. Curious how you measure which outbound motions actually turn into pipeline at Cartwheel. We built Relaypoint for that question. Open to comparing notes?",
            why: 'Quoted their recent post on outbound · Role: head of growth · Your pillar: deal risk',
        },
        Marcus: {
            text: "Hi Marcus, RevOps leaders I talk to spend Monday mornings rebuilding the forecast by hand. Relaypoint keeps it live across CRM, calls and email, no extra tooling. Would a quick walkthrough be useful for Northwind?",
            why: 'Role: director of RevOps · ICP pain: stale CRM forecasts · Step 1 of 2',
        },
        Elena: {
            text: "Hi Elena, your quarterly pipeline review was a great read, especially qualifying earlier. Relaypoint flags deals that are drifting so reps can requalify before the forecast call. Would it be worth 15 minutes to see it on Pallet's pipeline?",
            why: 'Their post on pipeline reviews · Role: CRO · Your pillar: deal risk',
        },
        Aiko: {
            text: "Hi Aiko, congrats on shipping the agent SDK. Two years in one launch is huge. As the sales team grows to meet that launch, we can help keep the forecast honest from day one. Open to a quick chat?",
            why: 'Recent product launch post · Role: co-founder · Step 1 of 2',
        },
    };
    const replies: Record<string, string> = {
        Sarah: "Ha, it's been a ride. The forecast part is real, our last two quarters were a guessing game. Thursday at 10 works?",
        Daniel: 'Thanks Maya! Timing is good, we are building the sales team now. Send over a few times next week.',
        Priya: "Love that you read the post. Honestly we don't measure it well yet. Happy to compare notes, how's Friday?",
        Marcus: 'Monday mornings are exactly that, yes. Can you share a short demo video first?',
    };

    for (const [i, lead] of inCampaign.slice(0, 9).entries()) {
        const o = opener[lead.firstName!] ?? {
            text: `Hi ${lead.firstName}, thanks for connecting. I work with sales leaders at teams like ${lead.company} on keeping the forecast honest as they scale. Would a short walkthrough be useful?`,
            why: `Role: ${lead.jobTitle} · Company: ${lead.company} · Step 1 of 2`,
        };
        const sentAt = openerSentAt(i);
        await prisma.message.create({
            data: { userId: USER_ID, leadId: lead.id, campaignId: main.id, direction: 'SENT', content: o.text, source: 'AI', rationale: o.why, sentAt },
        });
        const reply = replies[lead.firstName!];
        if (reply) {
            await prisma.message.create({
                data: { userId: USER_ID, leadId: lead.id, campaignId: main.id, direction: 'RECEIVED', content: reply, source: 'LINKEDIN', sentAt: lastActivity(i, lead.firstName!) },
            });
        }
    }
}

// The campaign Messages tab reads OUTBOUND/INBOUND while the inbox (and the
// engine) write SENT/RECEIVED. Flip before capturing that tab.
async function campaignDirections() {
    await prisma.message.updateMany({ where: { userId: USER_ID, direction: 'SENT' }, data: { direction: 'OUTBOUND' } });
    await prisma.message.updateMany({ where: { userId: USER_ID, direction: 'RECEIVED' }, data: { direction: 'INBOUND' } });
}

function token() {
    const secret = process.env.JWT_SECRET || 'supersecretkey';
    process.stdout.write(jwt.sign({ id: USER_ID, email: EMAIL }, secret, { expiresIn: '1h' }));
}

(async () => {
    const cmd = process.argv[2];
    if (cmd !== 'token' && !/\/qampi_landing_demo(\?|$)/.test(process.env.DATABASE_URL || '')) {
        throw new Error('Refusing to run: DATABASE_URL must point at the qampi_landing_demo database.');
    }
    if (cmd === 'seed') await seed();
    else if (cmd === 'campaign-directions') await campaignDirections();
    else if (cmd === 'cleanup') await cleanup();
    else if (cmd === 'token') token();
    else throw new Error(`unknown command: ${cmd}`);
    await prisma.$disconnect();
})().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
