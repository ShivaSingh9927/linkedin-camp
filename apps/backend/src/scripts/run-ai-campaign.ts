import { runCampaign } from '../campaign-engine';
import { PrismaClient } from '@repo/db';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const SESSION_STORAGE_PATH = process.env.SESSION_STORAGE_PATH || path.join(process.cwd(), '..', '..', 'sessions');
const USER_ID = 'eef74901-4b70-44a8-89b9-437f6210d5ff';

async function main() {
    const campaignId = 'ai-msg-camp-' + Date.now();
    
    console.log('\n=== Creating AI Campaign (Profile-Visit → Message with AI) ===\n');
    console.log('Session path:', SESSION_STORAGE_PATH);
    
    // Load session from disk (like campaign-worker does)
    const sessionDir = path.join(SESSION_STORAGE_PATH, USER_ID);
    let parsedCookies: any[] | null = null;
    let parsedUserAgent: string | null = null;
    let parsedLocalStorage: any = null;
    
    if (fs.existsSync(sessionDir)) {
        try {
            const ckPath = path.join(sessionDir, 'cookies.json');
            if (fs.existsSync(ckPath)) {
                parsedCookies = JSON.parse(fs.readFileSync(ckPath, 'utf-8'));
                console.log('Loaded cookies:', parsedCookies?.length || 0);
            }
        } catch (e: any) {
            console.error('Failed to load cookies:', e.message);
        }
        
        try {
            const fpPath = path.join(sessionDir, 'fingerprint.json');
            if (fs.existsSync(fpPath)) {
                const fp = JSON.parse(fs.readFileSync(fpPath, 'utf-8'));
                parsedUserAgent = fp?.userAgent || null;
                console.log('Loaded userAgent:', parsedUserAgent ? 'yes' : 'no');
            }
        } catch (e: any) {
            console.error('Failed to load fingerprint:', e.message);
        }
        
        try {
            const lsPath = path.join(sessionDir, 'localStorage.json');
            if (fs.existsSync(lsPath)) {
                parsedLocalStorage = JSON.parse(fs.readFileSync(lsPath, 'utf-8'));
                console.log('Loaded localStorage keys:', parsedLocalStorage ? Object.keys(parsedLocalStorage).length : 0);
            }
        } catch (e: any) {
            console.error('Failed to load localStorage:', e.message);
        }
    }
    
    if (!parsedCookies || parsedCookies.length === 0) {
        console.log('❌ No session cookies found. Run cloud-login first.');
        process.exit(1);
    }
    
    // Get or create test lead
    let lead = await prisma.lead.findFirst({
        where: { userId: USER_ID, linkedinUrl: { startsWith: 'https://www.linkedin.com/in/shiva-singh' } }
    });
    
    if (!lead) {
        const id = 'lead-' + Date.now();
        lead = await prisma.lead.create({
            data: {
                id,
                userId: USER_ID,
                linkedinUrl: 'https://www.linkedin.com/in/shiva-singh-genai-llm/',
                firstName: 'Shiva',
                lastName: 'Singh',
                updatedAt: new Date()
            }
        });
        console.log('Created test lead:', lead.id);
    } else {
        console.log('Using existing lead:', lead.id);
    }
    
    // Create campaign with profile-visit -> send-message (AI enabled)
    const workflowNodes = [
        { node: 'profile-visit' as const },
        { 
            node: 'send-message' as const, 
            aiEnabled: true,
            tone: 'professional',
            cta: 'connect'
        }
    ];
    
    const campaign = await prisma.campaign.create({
        data: {
            id: campaignId,
            userId: USER_ID,
            name: 'AI Message Campaign',
            workflowJson: { nodes: workflowNodes },
            status: 'DRAFT',
            objective: 'Connect with prospects',
            toneOverride: 'professional',
            cta: 'connect'
        }
    });
    
    console.log('Created campaign:', campaign.id);
    
    // Add lead to campaign
    await prisma.campaignLead.create({
        data: {
            id: 'cl-' + Date.now(),
            campaignId: campaign.id,
            leadId: lead.id,
            isCompleted: false
        }
    });
    
    console.log('Added lead to campaign\n');
    
    // Run campaign
    const campaignDescription = 'AI-powered personalized outreach to generate leads through LinkedIn';
    const config = {
        flow: workflowNodes,
        objective: campaign.objective || 'Connect with prospects',
        campaignDescription,
        cta: campaign.cta || 'connect',
        toneOverride: campaign.toneOverride || 'professional',
        persona: undefined,
        valueProp: undefined,
        sessionContext: {
            cookies: parsedCookies,
            userAgent: parsedUserAgent,
            localStorage: parsedLocalStorage,
            proxy: undefined
        }
    };
    
    console.log('🚀 Running campaign...\n');
    
    const summary = await runCampaign(USER_ID, campaign.id, config);
    
    // Print final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CAMPAIGN RESULT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Campaign ID:   ${summary.campaignId}`);
    console.log(`Total Leads:   ${summary.totalLeads}`);
    console.log(`Succeeded:    ${summary.succeeded}`);
    console.log(`Failed:       ${summary.failed}`);
    console.log(`Started At:   ${summary.startedAt}`);
    console.log(`Completed At: ${summary.completedAt}`);
    console.log('\n--- Lead Results ---');
    
    for (const lr of summary.leadResults) {
        const status = lr.status === 'completed' ? '✅' : '❌';
        console.log(`\n${status} Lead: ${lr.leadName}`);
        console.log(`   Nodes: ${lr.nodesExecuted.map(n => `${n.node} (${n.status})`).join(' -> ')}`);
        
        for (const n of lr.nodesExecuted) {
            if (n.status === 'failed') {
                console.log(`   ❌ ${n.node}: ${n.error}`);
            }
            if (n.output) {
                const out = n.output as any;
                if (out.messageText) {
                    console.log(`   📝 Message: ${out.messageText.substring(0, 80)}...`);
                }
                if (out.name || out.company) {
                    console.log(`   👤 Profile: ${out.name || 'N/A'} - ${out.company || out.jobTitle || 'N/A'}`);
                }
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    
    await prisma.$disconnect();
}

main()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });