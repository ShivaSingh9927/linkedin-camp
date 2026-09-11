import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPABILITIES, COPILOT_INTENTS } from '../capabilities';
import { COPILOT_HARNESS_CASES, contextFor } from './cases';

test('golden dataset has unique ids and covers every intent', () => {
    const ids = COPILOT_HARNESS_CASES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    const covered = new Set(COPILOT_HARNESS_CASES.flatMap((c) => c.expected.intents));
    for (const intent of COPILOT_INTENTS) assert.ok(covered.has(intent), `Missing fixture for ${intent}`);
});
test('every side-effect capability has a confirmation fixture', () => {
    for (const capability of CAPABILITIES.filter((c) => c.sideEffect)) {
        assert.ok(COPILOT_HARNESS_CASES.some((c) => c.expected.intents.includes(capability.intent) && c.expected.confirmation === 'required'));
    }
});

test('case context overrides do not mutate the baseline', () => {
    const disconnected = COPILOT_HARNESS_CASES.find((c) => c.id === 'session-expired')!;
    assert.equal(contextFor(disconnected).linkedinConnected, false);
    const ordinary = COPILOT_HARNESS_CASES.find((c) => c.id === 'route-find-leads')!;
    assert.equal(contextFor(ordinary).linkedinConnected, true);
});
