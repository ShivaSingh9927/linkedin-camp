import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCopilotHarness } from './copilot-harness-metrics';
import {
    clearCopilotHarnessTurns,
    readCopilotHarnessTurns,
    recordCopilotHarnessTurn,
    updateCopilotHarnessTurn,
} from './copilot-harness-store';

test('browser harness stores metadata, updates outcomes, expires old rows, and clears', async () => {
    await clearCopilotHarnessTurns();
    await recordCopilotHarnessTurn({
        id: 'expired', createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        kind: 'route', success: true, latencyMs: 20,
    });
    await recordCopilotHarnessTurn({
        id: 'draft', createdAt: Date.now(), kind: 'reply_draft', success: true,
        latencyMs: 120, outputChars: 80, outcome: 'generated', qualityFlags: [],
    });
    await updateCopilotHarnessTurn('draft', { outcome: 'sent', edited: true, outputChars: 76 });

    const rows = await readCopilotHarnessTurns();
    assert.equal(rows.some((row) => row.id === 'expired'), false);
    const draft = rows.find((row) => row.id === 'draft');
    assert.equal(draft?.outcome, 'sent');
    assert.equal(draft?.edited, true);
    assert.equal(draft?.outputChars, 76);

    const summary = summarizeCopilotHarness(rows);
    assert.equal(summary.replyDrafts, 1);
    assert.equal(summary.sentDrafts, 1);
    assert.equal(summary.sendRate, 100);

    await clearCopilotHarnessTurns();
    assert.deepEqual(await readCopilotHarnessTurns(), []);

    for (let index = 0; index < 505; index += 1) {
        await recordCopilotHarnessTurn({
            id: `bounded-${index}`,
            createdAt: Date.now() + index,
            kind: 'route',
            success: true,
            latencyMs: index,
        });
    }
    assert.equal((await readCopilotHarnessTurns()).length, 500);
    await clearCopilotHarnessTurns();
});
