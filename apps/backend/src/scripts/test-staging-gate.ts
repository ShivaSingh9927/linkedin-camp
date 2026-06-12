/**
 * Offline unit test for the staging / acceptance-gate decision logic.
 *
 * Verifies the two pure flow-shape helpers that drive the engine's new
 * behavior:
 *   - nextStageRequiresConnection — does the delay function as an
 *     acceptance-wait (so an already-1st-degree lead may skip it)?
 *   - stageRequiresConnection — on resume, does the upcoming stage need a
 *     1st-degree connection (so an unaccepted lead must give up)?
 *
 * No LinkedIn / DB / browser — runs purely on flow arrays.
 *   npx ts-node --transpile-only src/scripts/test-staging-gate.ts
 */
import { NodeType } from '../campaign-engine/types';
import {
    stageRequiresConnection,
    nextStageRequiresConnection,
} from '../campaign-engine/linkedin-permissions';

const f = (...nodes: NodeType[]) => nodes.map(node => ({ node }));

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${actual}, want ${expected})`);
}

// connect → delay → message : the canonical cold-outreach stage.
const cold = f('connect', 'delay', 'send-message');
console.log('Flow: connect → delay → send-message');
check('delay@1 is an acceptance-wait', nextStageRequiresConnection(cold, 1), true);
check('resume@2 (message) requires connection', stageRequiresConnection(cold, 2), true);
check('whole flow requires connection', stageRequiresConnection(cold, 0), true);

// connect → delay → like : like works on any degree, so NOT an acceptance-wait.
const engage = f('connect', 'delay', 'like-nth-post');
console.log('Flow: connect → delay → like-nth-post');
check('delay@1 is NOT an acceptance-wait', nextStageRequiresConnection(engage, 1), false);
check('resume@2 (like) does NOT require connection', stageRequiresConnection(engage, 2), false);

// Two-stage: profile-visit → delay → like → delay → message.
const twoStage = f('profile-visit', 'delay', 'like-nth-post', 'delay', 'send-message');
console.log('Flow: profile-visit → delay → like → delay → message');
check('first delay@1 NOT acceptance-wait (next stage is like)', nextStageRequiresConnection(twoStage, 1), false);
check('second delay@3 IS acceptance-wait (next stage is message)', nextStageRequiresConnection(twoStage, 3), true);
check('resume@2 (like then message later) requires connection', stageRequiresConnection(twoStage, 2), true);
check('resume@4 (message) requires connection', stageRequiresConnection(twoStage, 4), true);

// email-finder is degree-agnostic (external box) → must NOT gate.
const emailFlow = f('connect', 'delay', 'email-finder', 'email');
console.log('Flow: connect → delay → email-finder → email');
check('delay@1 NOT acceptance-wait (email-finder works any degree)', nextStageRequiresConnection(emailFlow, 1), false);
check('resume@2 does NOT require connection', stageRequiresConnection(emailFlow, 2), false);

// Edge cases.
console.log('Edge cases');
check('empty flow', stageRequiresConnection([], 0), false);
check('fromIndex past end', stageRequiresConnection(cold, 99), false);
check('negative fromIndex clamps to 0', stageRequiresConnection(cold, -5), true);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
