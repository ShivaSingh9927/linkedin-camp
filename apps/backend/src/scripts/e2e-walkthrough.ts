/**
 * E2E Walkthrough Test Script
 * 
 * Tests the complete flow:
 *   1. Register a test user
 *   2. Login and get JWT token
 *   3. Import test leads
 *   4. Create a campaign from template
 *   5. Start the campaign with leads
 *   6. Check campaign status
 *   7. Verify action logs
 * 
 * Usage:
 *   npx tsx apps/backend/src/scripts/e2e-walkthrough.ts
 * 
 * Prerequisites:
 *   - Backend running on http://localhost:3001
 *   - PostgreSQL + Redis running
 */

const BASE_URL = 'http://localhost:3001/api/v1';
const TEST_EMAIL = `e2e-test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';

interface StepResult {
    step: number;
    name: string;
    passed: boolean;
    detail: string;
    data?: any;
}

const results: StepResult[] = [];

async function api(method: string, path: string, body?: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }

    return { status: res.status, data: json, ok: res.ok };
}

function log(icon: string, msg: string) {
    console.log(`${icon}  ${msg}`);
}

function pass(step: number, name: string, detail: string, data?: any) {
    results.push({ step, name, passed: true, detail, data });
    log('✅', `Step ${step}: ${name} — ${detail}`);
}

function fail(step: number, name: string, detail: string) {
    results.push({ step, name, passed: false, detail });
    log('❌', `Step ${step}: ${name} — ${detail}`);
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   LinkedIn Campaign — E2E Walkthrough Test   ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    let token = '';
    let userId = '';
    let leadIds: string[] = [];
    let campaignId = '';

    // ──────────────────────────────────────────────
    // Step 1: Register
    // ──────────────────────────────────────────────
    try {
        const res = await api('POST', '/auth/register', {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        });
        if (res.ok && res.data.token) {
            token = res.data.token;
            userId = res.data.user?.id || 'unknown';
            pass(1, 'Register User', `Registered ${TEST_EMAIL} (id: ${userId.slice(0, 8)}...)`, res.data);
        } else {
            fail(1, 'Register User', `Status ${res.status}: ${JSON.stringify(res.data)}`);
            return;
        }
    } catch (e: any) {
        fail(1, 'Register User', `Network error: ${e.message}`);
        console.log('\n⚠️  Is the backend running on port 3001?\n');
        return;
    }

    // ──────────────────────────────────────────────
    // Step 2: Login (verify token works)
    // ──────────────────────────────────────────────
    try {
        const res = await api('POST', '/auth/login', {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        });
        if (res.ok && res.data.token) {
            token = res.data.token; // use fresh token
            pass(2, 'Login', 'JWT token obtained successfully');
        } else {
            fail(2, 'Login', `Status ${res.status}: ${JSON.stringify(res.data)}`);
            return;
        }
    } catch (e: any) {
        fail(2, 'Login', `Error: ${e.message}`);
        return;
    }

    // ──────────────────────────────────────────────
    // Step 3: Generate demo leads
    // ──────────────────────────────────────────────
    try {
        const res = await api('POST', '/leads/demo', {}, token);
        if (res.ok) {
            pass(3, 'Generate Demo Leads', 'Demo leads created');
        } else {
            fail(3, 'Generate Demo Leads', `Status ${res.status}`);
        }
    } catch (e: any) {
        fail(3, 'Generate Demo Leads', `Error: ${e.message}`);
    }

    // ──────────────────────────────────────────────
    // Step 4: Fetch leads
    // ──────────────────────────────────────────────
    try {
        const res = await api('GET', '/leads', undefined, token);
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
            leadIds = res.data.map((l: any) => l.id);
            const sample = res.data[0];
            pass(4, 'Fetch Leads', `${res.data.length} leads found (${sample.firstName} ${sample.lastName}, ${sample.country || 'no country'}, tags: [${(sample.tags || []).join(', ')}])`);
        } else {
            fail(4, 'Fetch Leads', `Expected leads array, got ${res.status}`);
        }
    } catch (e: any) {
        fail(4, 'Fetch Leads', `Error: ${e.message}`);
    }

    // ──────────────────────────────────────────────
    // Step 5: Create campaign from template
    // ──────────────────────────────────────────────
    const templateWorkflow = {
        nodes: [
            { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 0 } },
            { id: 'n1', type: 'ACTION', subType: 'PROFILE_VISIT', data: { label: 'Visit Profile' }, position: { x: 250, y: 100 } },
            { id: 'n2', type: 'DELAY', subType: 'WAIT', data: { label: 'Wait 1 day', delayDays: 1 }, position: { x: 250, y: 200 } },
            { id: 'n3', type: 'ACTION', subType: 'MESSAGE', data: { label: 'Send Message', message: 'Hi {firstName}, thanks for connecting!' }, position: { x: 250, y: 300 } },
        ],
        edges: [
            { id: 'e1', source: 'trigger', target: 'n1' },
            { id: 'e2', source: 'n1', target: 'n2' },
            { id: 'e3', source: 'n2', target: 'n3' },
        ],
    };

    try {
        const res = await api('POST', '/campaigns', {
            name: 'E2E Test Campaign',
            workflowJson: templateWorkflow,
        }, token);
        if (res.ok && res.data.id) {
            campaignId = res.data.id;
            pass(5, 'Create Campaign', `Campaign created (id: ${campaignId.slice(0, 8)}...)`);
        } else {
            fail(5, 'Create Campaign', `Status ${res.status}: ${JSON.stringify(res.data)}`);
        }
    } catch (e: any) {
        fail(5, 'Create Campaign', `Error: ${e.message}`);
    }

    // ──────────────────────────────────────────────
    // Step 6: Start campaign with leads
    // ──────────────────────────────────────────────
    if (campaignId && leadIds.length > 0) {
        try {
            const res = await api('POST', `/campaigns/${campaignId}/start`, {
                leadIds: leadIds.slice(0, 3), // use first 3 leads
            }, token);
            if (res.ok) {
                pass(6, 'Start Campaign', `Campaign started with ${Math.min(3, leadIds.length)} leads`);
            } else {
                fail(6, 'Start Campaign', `Status ${res.status}: ${JSON.stringify(res.data)}`);
            }
        } catch (e: any) {
            fail(6, 'Start Campaign', `Error: ${e.message}`);
        }
    } else {
        fail(6, 'Start Campaign', 'Skipped (no campaign or leads)');
    }

    // ──────────────────────────────────────────────
    // Step 7: Check campaign status
    // ──────────────────────────────────────────────
    if (campaignId) {
        try {
            const res = await api('GET', `/campaigns/${campaignId}/status`, undefined, token);
            if (res.ok && res.data.leads) {
                const enrolled = res.data.leads.length;
                const completed = res.data.leads.filter((l: any) => l.isCompleted).length;
                pass(7, 'Campaign Status', `${enrolled} leads enrolled, ${completed} completed, campaign status: ${res.data.campaign.status}`);
            } else {
                fail(7, 'Campaign Status', `Status ${res.status}`);
            }
        } catch (e: any) {
            fail(7, 'Campaign Status', `Error: ${e.message}`);
        }
    }

    // ──────────────────────────────────────────────
    // Step 8: Check stats endpoint
    // ──────────────────────────────────────────────
    try {
        const res = await api('GET', '/stats', undefined, token);
        if (res.ok) {
            pass(8, 'Dashboard Stats', `Leads: ${res.data.totalLeads}, Active campaigns: ${res.data.activeCampaigns}, Successful actions: ${res.data.successfulActions}`);
        } else {
            fail(8, 'Dashboard Stats', `Status ${res.status}`);
        }
    } catch (e: any) {
        fail(8, 'Dashboard Stats', `Error: ${e.message}`);
    }

    // ──────────────────────────────────────────────
    // Step 9: Update campaign (test save)
    // ──────────────────────────────────────────────
    if (campaignId) {
        try {
            const res = await api('PUT', `/campaigns/${campaignId}`, {
                name: 'E2E Test Campaign (Updated)',
                workflowJson: templateWorkflow,
            }, token);
            if (res.ok) {
                pass(9, 'Update Campaign', 'Campaign renamed successfully');
            } else {
                fail(9, 'Update Campaign', `Status ${res.status}`);
            }
        } catch (e: any) {
            fail(9, 'Update Campaign', `Error: ${e.message}`);
        }
    }

    // ──────────────────────────────────────────────
    // Step 10: Pause campaign
    // ──────────────────────────────────────────────
    if (campaignId) {
        try {
            const res = await api('POST', `/campaigns/${campaignId}/pause`, {}, token);
            if (res.ok && res.data.status === 'PAUSED') {
                pass(10, 'Pause Campaign', 'Campaign paused successfully');
            } else {
                fail(10, 'Pause Campaign', `Status ${res.status}, got: ${res.data?.status}`);
            }
        } catch (e: any) {
            fail(10, 'Pause Campaign', `Error: ${e.message}`);
        }
    }

    // ──────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────
    console.log('\n══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('══════════════════════════════════════');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\n  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📝 Total:  ${results.length}`);

    if (failed > 0) {
        console.log('\n  Failed steps:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`    - Step ${r.step}: ${r.name} — ${r.detail}`);
        });
    }

    console.log(`\n  Test user: ${TEST_EMAIL}`);
    console.log(`  Campaign ID: ${campaignId || 'N/A'}`);
    console.log(`  Lead count: ${leadIds.length}`);
    console.log('');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
