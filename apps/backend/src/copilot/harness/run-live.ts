import { renderCapabilityContract, COPILOT_INTENTS } from '../capabilities';
import { COPILOT_HARNESS_CASES, contextFor } from './cases';
import { evaluateCopilotTurn } from './graders';
import type { CopilotHarnessObservation } from './types';

const CASE_TIMEOUT_MS = Number(process.env.COPILOT_HARNESS_TIMEOUT_MS || 30_000);

async function runCase(testCase: (typeof COPILOT_HARNESS_CASES)[number], baseUrl: string) {
    const started = Date.now();
    try {
        const response = await fetch(`${baseUrl}/ai/copilot/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: testCase.message,
                history: testCase.history,
                system_context: renderCapabilityContract(contextFor(testCase)),
                allowed_intents: COPILOT_INTENTS,
            }),
            signal: AbortSignal.timeout(CASE_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`AI service returned ${response.status}`);
        const observation = await response.json() as CopilotHarnessObservation;
        observation.latencyMs = Date.now() - started;
        return evaluateCopilotTurn(testCase, observation);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            caseId: testCase.id,
            passed: false,
            score: 0,
            findings: [{ code: 'runner_error', severity: 'error' as const, message }],
            observation: {
                intent: 'runner_error',
                reply: '',
                needsConfirm: false,
                latencyMs: Date.now() - started,
            },
        };
    }
}

async function main() {
    const requestedIds = new Set(
        (process.env.COPILOT_HARNESS_CASES || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
    );
    const selectedCases = requestedIds.size
        ? COPILOT_HARNESS_CASES.filter((testCase) => requestedIds.has(testCase.id))
        : COPILOT_HARNESS_CASES;
    const maxCalls = Number(process.env.COPILOT_HARNESS_MAX_CALLS || 5);
    const minimumPassRate = Number(process.env.COPILOT_HARNESS_MIN_PASS_RATE || 1);
    const minimumAverage = Number(process.env.COPILOT_HARNESS_MIN_AVERAGE_SCORE || 90);
    const maxP95 = Number(process.env.COPILOT_HARNESS_MAX_P95_MS || 30_000);

    if (requestedIds.size && selectedCases.length !== requestedIds.size) {
        const found = new Set(selectedCases.map((testCase) => testCase.id));
        const unknown = [...requestedIds].filter((id) => !found.has(id));
        throw new Error(`Unknown harness case${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`);
    }

    if (process.env.COPILOT_HARNESS_LIVE !== '1') {
        console.log('Live copilot evaluation is disabled to avoid API spend. Set COPILOT_HARNESS_LIVE=1 to run it.');
        console.log(`Dataset ready: ${selectedCases.length} case${selectedCases.length === 1 ? '' : 's'}.`);
        return;
    }

    if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new Error('COPILOT_HARNESS_MAX_CALLS must be a positive integer');
    if (selectedCases.length > maxCalls) {
        throw new Error(`Refusing ${selectedCases.length} live calls; COPILOT_HARNESS_MAX_CALLS is ${maxCalls}. Select fewer cases or raise the cap explicitly.`);
    }
    if (!Number.isFinite(minimumPassRate) || minimumPassRate < 0 || minimumPassRate > 1) {
        throw new Error('COPILOT_HARNESS_MIN_PASS_RATE must be between 0 and 1');
    }
    if (!Number.isFinite(minimumAverage) || minimumAverage < 0 || minimumAverage > 100) {
        throw new Error('COPILOT_HARNESS_MIN_AVERAGE_SCORE must be between 0 and 100');
    }
    if (!Number.isFinite(maxP95) || maxP95 < 1) throw new Error('COPILOT_HARNESS_MAX_P95_MS must be positive');

    const baseUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
    const results = [];
    for (const testCase of selectedCases) {
        const result = await runCase(testCase, baseUrl);
        results.push(result);
        console.log(`${result.passed ? 'PASS' : 'FAIL'} ${testCase.id} (${result.score}, ${result.observation.latencyMs}ms)`);
        for (const item of result.findings) console.log(`  ${item.severity}: ${item.code} — ${item.message}`);
    }

    const passed = results.filter((r) => r.passed).length;
    const average = Math.round(results.reduce((sum, r) => sum + r.score, 0) / Math.max(results.length, 1));
    const latencies = results.map((r) => r.observation.latencyMs || 0).sort((a, b) => a - b);
    const p95 = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] || 0;
    const passRate = passed / Math.max(results.length, 1);
    console.log(`\n${passed}/${results.length} passed; average score ${average}; p95 latency ${p95}ms.`);
    if (passRate < minimumPassRate || average < minimumAverage || p95 > maxP95) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
