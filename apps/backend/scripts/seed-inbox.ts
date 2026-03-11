/**
 * Seed script for Inbox Phase 1 testing
 * Creates sample conversations, templates, and notifications for an existing user
 * 
 * Usage: npx ts-node scripts/seed-inbox.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Find the first user
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('❌ No users found. Register first via the web app.');
        process.exit(1);
    }
    console.log(`✅ Found user: ${user.email} (${user.id})`);

    // 2. Find existing leads for this user
    let leads = await prisma.lead.findMany({
        where: { userId: user.id },
        take: 10,
    });

    // If no leads exist, create sample leads
    if (leads.length === 0) {
        console.log('📌 No leads found, creating sample leads...');
        await prisma.lead.createMany({
            data: [
                {
                    userId: user.id,
                    linkedinUrl: 'https://www.linkedin.com/in/sarah-conner-ai',
                    firstName: 'Sarah',
                    lastName: 'Conner',
                    jobTitle: 'CEO & Founder',
                    company: 'FutureTech AI',
                    country: 'United States',
                    gender: 'female',
                    tags: ['ai-leaders', 'tech-founders'],
                    status: 'CONNECTED',
                },
                {
                    userId: user.id,
                    linkedinUrl: 'https://www.linkedin.com/in/rajiv-sharma-ml',
                    firstName: 'Rajiv',
                    lastName: 'Sharma',
                    jobTitle: 'VP Engineering',
                    company: 'DataPulse',
                    country: 'India',
                    gender: 'male',
                    tags: ['ai-leaders'],
                    status: 'INVITE_PENDING',
                },
                {
                    userId: user.id,
                    linkedinUrl: 'https://www.linkedin.com/in/priya-patel-startup',
                    firstName: 'Priya',
                    lastName: 'Patel',
                    jobTitle: 'CTO',
                    company: 'NexGen Solutions',
                    country: 'India',
                    gender: 'female',
                    tags: ['tech-founders'],
                    status: 'CONNECTED',
                },
                {
                    userId: user.id,
                    linkedinUrl: 'https://www.linkedin.com/in/james-bond-fintech',
                    firstName: 'James',
                    lastName: 'Bond',
                    jobTitle: 'Head of Product',
                    company: 'FinScale',
                    country: 'United Kingdom',
                    gender: 'male',
                    tags: ['fintech-leaders'],
                    status: 'REPLIED',
                },
                {
                    userId: user.id,
                    linkedinUrl: 'https://www.linkedin.com/in/lisa-chen-design',
                    firstName: 'Lisa',
                    lastName: 'Chen',
                    jobTitle: 'Design Director',
                    company: 'CreativeHub',
                    country: 'Singapore',
                    gender: 'female',
                    tags: ['design-leaders'],
                    status: 'CONNECTED',
                },
            ],
        });

        leads = await prisma.lead.findMany({
            where: { userId: user.id },
            take: 10,
        });
        console.log(`✅ Created ${leads.length} sample leads`);
    } else {
        console.log(`✅ Found ${leads.length} existing leads`);
    }

    // 3. Create sample message templates
    console.log('\n📝 Creating message templates...');
    const templateData = [
        {
            name: 'Cold Intro',
            content: 'Hi {{firstName}}, I noticed you\'re leading {{jobTitle}} at {{company}}. I\'d love to connect and share some ideas about AI-powered automation that could help your team. Would you be open to a quick chat?',
            variables: ['firstName', 'jobTitle', 'company'],
            category: 'intro',
        },
        {
            name: 'Follow-up After Connect',
            content: 'Hey {{firstName}}! Thanks for accepting my connection request. I saw that {{company}} is doing incredible work. I\'ve been working on LinkedIn automation tools and thought there might be some synergy. Any interest in a 15-min call this week?',
            variables: ['firstName', 'company'],
            category: 'follow_up',
        },
        {
            name: 'Value Proposition',
            content: 'Hi {{firstName}}, quick question — are you currently automating your LinkedIn outreach at {{company}}? We\'ve helped 200+ companies increase their response rates by 3x using AI-personalized messaging. Happy to share more if you\'re interested!',
            variables: ['firstName', 'company'],
            category: 'intro',
        },
        {
            name: 'Soft Close',
            content: '{{firstName}}, just following up on my earlier message. I know you\'re busy at {{company}}, so I\'ll keep this brief: would a 10-minute demo next week work? If not, no worries at all — I appreciate your time!',
            variables: ['firstName', 'company'],
            category: 'closing',
        },
        {
            name: 'Invite Note',
            content: 'Hi {{firstName}}, I came across your profile and was impressed by your work at {{company}}. Would love to connect and exchange ideas about {{jobTitle}} in the industry.',
            variables: ['firstName', 'company', 'jobTitle'],
            category: 'invite',
        },
    ];

    for (const tmpl of templateData) {
        await prisma.messageTemplate.upsert({
            where: { userId_name: { userId: user.id, name: tmpl.name } },
            update: { content: tmpl.content, variables: tmpl.variables, category: tmpl.category },
            create: { userId: user.id, ...tmpl },
        });
    }
    console.log(`✅ Upserted ${templateData.length} message templates`);

    // 4. Create sample conversations (messages for leads)
    console.log('\n💬 Creating sample conversations...');

    const now = new Date();
    const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60000);
    const hoursAgo = (hrs: number) => new Date(now.getTime() - hrs * 3600000);
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

    // Conversation with Sarah Conner (active back-and-forth)
    const sarah = leads.find(l => l.firstName === 'Sarah') || leads[0];
    if (sarah) {
        // Clear existing messages for clean test
        await prisma.message.deleteMany({ where: { leadId: sarah.id, userId: user.id } });

        await prisma.message.createMany({
            data: [
                {
                    userId: user.id,
                    leadId: sarah.id,
                    direction: 'SENT',
                    content: `Hi Sarah, I noticed you're leading as CEO & Founder at FutureTech AI. I'd love to connect and share some ideas about AI-powered automation that could help your team. Would you be open to a quick chat?`,
                    source: 'CAMPAIGN',
                    sentAt: daysAgo(5),
                },
                {
                    userId: user.id,
                    leadId: sarah.id,
                    direction: 'RECEIVED',
                    content: `Hi! Thanks for reaching out. I'm always interested in AI automation tools. What specifically does your product do?`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: daysAgo(4),
                },
                {
                    userId: user.id,
                    leadId: sarah.id,
                    direction: 'SENT',
                    content: `Great to hear! We've built a LinkedIn campaign engine that automates outreach with AI-personalized messages. Think of it as LEADMATE but with better personalization and a built-in CRM.\n\nKey features:\n• Smart lead extraction from LinkedIn\n• AI-written personalized messages\n• Multi-step campaign workflows\n• Built-in inbox for managing replies\n\nWould a 15-min demo work this week?`,
                    source: 'MANUAL',
                    sentAt: daysAgo(3),
                },
                {
                    userId: user.id,
                    leadId: sarah.id,
                    direction: 'RECEIVED',
                    content: `This sounds really interesting! We've been looking for something better than our current setup. How about Thursday at 2 PM EST?`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: daysAgo(2),
                },
                {
                    userId: user.id,
                    leadId: sarah.id,
                    direction: 'SENT',
                    content: `Perfect! Thursday 2 PM EST works great. I'll send you a calendar invite. Looking forward to showing you what we've built! 🚀`,
                    source: 'MANUAL',
                    sentAt: daysAgo(1),
                },
            ],
        });
        console.log(`  ✅ Sarah Conner: 5 messages (active conversation)`);
    }

    // Conversation with Rajiv (sent invite, no reply yet)
    const rajiv = leads.find(l => l.firstName === 'Rajiv') || leads[1];
    if (rajiv && rajiv.id !== sarah?.id) {
        await prisma.message.deleteMany({ where: { leadId: rajiv.id, userId: user.id } });
        await prisma.message.createMany({
            data: [
                {
                    userId: user.id,
                    leadId: rajiv.id,
                    direction: 'SENT',
                    content: `Hi Rajiv, I came across your profile and was impressed by your work at DataPulse. Would love to connect and exchange ideas about VP Engineering in the AI/ML industry.`,
                    source: 'CAMPAIGN',
                    sentAt: daysAgo(3),
                },
            ],
        });
        console.log(`  ✅ Rajiv Sharma: 1 message (awaiting reply)`);
    }

    // Conversation with Priya (good exchange)
    const priya = leads.find(l => l.firstName === 'Priya') || leads[2];
    if (priya && priya.id !== sarah?.id && priya.id !== rajiv?.id) {
        await prisma.message.deleteMany({ where: { leadId: priya.id, userId: user.id } });
        await prisma.message.createMany({
            data: [
                {
                    userId: user.id,
                    leadId: priya.id,
                    direction: 'SENT',
                    content: `Hi Priya, quick question — are you currently automating your LinkedIn outreach at NexGen Solutions? We've helped 200+ companies increase their response rates by 3x.`,
                    source: 'CAMPAIGN',
                    sentAt: daysAgo(7),
                },
                {
                    userId: user.id,
                    leadId: priya.id,
                    direction: 'RECEIVED',
                    content: `Hey! We actually just started exploring automation tools. What makes yours different from LEADMATE or Lemlist?`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: daysAgo(6),
                },
                {
                    userId: user.id,
                    leadId: priya.id,
                    direction: 'SENT',
                    content: `Great timing! Three things that set us apart:\n1. AI-powered personalization that actually sounds human\n2. Built-in CRM so you don't need separate tools\n3. Much more affordable pricing\n\nWant me to set up a trial account for you?`,
                    source: 'MANUAL',
                    sentAt: daysAgo(5),
                },
            ],
        });
        console.log(`  ✅ Priya Patel: 3 messages (warm lead)`);
    }

    // Conversation with James (closed deal!)
    const james = leads.find(l => l.firstName === 'James') || leads[3];
    if (james && ![sarah?.id, rajiv?.id, priya?.id].includes(james.id)) {
        await prisma.message.deleteMany({ where: { leadId: james.id, userId: user.id } });
        await prisma.message.createMany({
            data: [
                {
                    userId: user.id,
                    leadId: james.id,
                    direction: 'SENT',
                    content: `Hi James, I noticed you're leading Product at FinScale. Our LinkedIn automation tool has been getting great traction in fintech. Would love to connect!`,
                    source: 'CAMPAIGN',
                    sentAt: daysAgo(10),
                },
                {
                    userId: user.id,
                    leadId: james.id,
                    direction: 'RECEIVED',
                    content: `Sure, always happy to explore new tools. Send me details?`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: daysAgo(9),
                },
                {
                    userId: user.id,
                    leadId: james.id,
                    direction: 'SENT',
                    content: `Awesome! Here's a quick overview of what we offer... [sent product deck]`,
                    source: 'MANUAL',
                    sentAt: daysAgo(8),
                },
                {
                    userId: user.id,
                    leadId: james.id,
                    direction: 'RECEIVED',
                    content: `This looks solid. We'd like to try it with our sales team. Can you set up 5 seats for a pilot?`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: daysAgo(3),
                },
                {
                    userId: user.id,
                    leadId: james.id,
                    direction: 'SENT',
                    content: `Absolutely! I've set up your pilot account with 5 seats. You'll get an email with login details shortly. Let me know if you need anything! 🎉`,
                    source: 'MANUAL',
                    sentAt: hoursAgo(6),
                },
                {
                    userId: user.id,
                    leadId: james.id,
                    direction: 'RECEIVED',
                    content: `Got it, the team is excited to try it out. Thanks for the quick setup!`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: minutesAgo(30),
                },
            ],
        });
        console.log(`  ✅ James Bond: 6 messages (converted lead!)`);
    }

    // Conversation with Lisa (initial outreach)
    const lisa = leads.find(l => l.firstName === 'Lisa') || leads[4];
    if (lisa && ![sarah?.id, rajiv?.id, priya?.id, james?.id].includes(lisa.id)) {
        await prisma.message.deleteMany({ where: { leadId: lisa.id, userId: user.id } });
        await prisma.message.createMany({
            data: [
                {
                    userId: user.id,
                    leadId: lisa.id,
                    direction: 'SENT',
                    content: `Hi Lisa, your design work at CreativeHub is amazing! I'm building a tool that helps creative agencies automate their client outreach on LinkedIn. Would love your perspective on it.`,
                    source: 'CAMPAIGN',
                    sentAt: hoursAgo(12),
                },
                {
                    userId: user.id,
                    leadId: lisa.id,
                    direction: 'RECEIVED',
                    content: `Thanks! That sounds interesting. We definitely struggle with outreach. Tell me more?`,
                    source: 'LINKEDIN_SYNC',
                    sentAt: hoursAgo(2),
                },
            ],
        });
        console.log(`  ✅ Lisa Chen: 2 messages (interested)`);
    }

    // 5. Create sample notifications
    console.log('\n🔔 Creating notifications...');
    // Clear old notifications first
    await prisma.notification.deleteMany({ where: { userId: user.id } });

    await prisma.notification.createMany({
        data: [
            {
                userId: user.id,
                type: 'new_reply',
                title: 'New reply from James Bond',
                body: '"Got it, the team is excited to try it out. Thanks for the quick setup!"',
                meta: { leadId: james?.id },
                read: false,
                createdAt: minutesAgo(30),
            },
            {
                userId: user.id,
                type: 'new_reply',
                title: 'New reply from Lisa Chen',
                body: '"Thanks! That sounds interesting. We definitely struggle with outreach."',
                meta: { leadId: lisa?.id },
                read: false,
                createdAt: hoursAgo(2),
            },
            {
                userId: user.id,
                type: 'campaign_complete',
                title: 'Campaign "AI Leaders Outreach" completed',
                body: 'All 50 leads have been processed. 12 replies received.',
                meta: {},
                read: false,
                createdAt: hoursAgo(4),
            },
            {
                userId: user.id,
                type: 'new_reply',
                title: 'New reply from Sarah Conner',
                body: '"This sounds really interesting! How about Thursday at 2 PM EST?"',
                meta: { leadId: sarah?.id },
                read: true,
                createdAt: daysAgo(2),
            },
            {
                userId: user.id,
                type: 'campaign_error',
                title: 'Campaign warning: Daily limit approaching',
                body: "You've used 28/30 LinkedIn invites today. Pausing campaigns.",
                meta: {},
                read: true,
                createdAt: daysAgo(1),
            },
            {
                userId: user.id,
                type: 'reminder',
                title: 'Reminder: Follow up with Priya Patel',
                body: 'You set a reminder to follow up about the trial account.',
                meta: { leadId: priya?.id },
                read: true,
                createdAt: daysAgo(3),
            },
        ],
    });
    console.log(`✅ Created 6 notifications (3 unread, 3 read)`);

    // 6. Summary
    const totalMessages = await prisma.message.count({ where: { userId: user.id } });
    const totalTemplates = await prisma.messageTemplate.count({ where: { userId: user.id } });
    const totalNotifs = await prisma.notification.count({ where: { userId: user.id } });

    console.log('\n' + '═'.repeat(50));
    console.log('📊 SEED COMPLETE:');
    console.log(`   💬 Messages:      ${totalMessages}`);
    console.log(`   📝 Templates:     ${totalTemplates}`);
    console.log(`   🔔 Notifications: ${totalNotifs}`);
    console.log(`   👤 User:          ${user.email}`);
    console.log('═'.repeat(50));
    console.log('\n🚀 Open http://localhost:3000/inbox to test!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
