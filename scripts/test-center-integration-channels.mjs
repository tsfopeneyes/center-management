import assert from 'node:assert/strict';
import { AnalysisError } from '../supabase/functions/_shared/centerAnalysis/contracts.mjs';
import { createSlackAnalysisAdapter } from '../supabase/functions/_shared/centerIntegration/slack.mjs';

let passed = 0;
const check = async (name, callback) => {
    await callback();
    passed += 1;
    console.log(`CENTER CHANNEL PASS ${name}`);
};

const forbidden = promise => assert.rejects(promise, error => error instanceof AnalysisError && error.code === 'forbidden');

await check('only a verified direct message reaches the common analysis service', async () => {
    const calls = [];
    const adapter = createSlackAnalysisAdapter({
        verifySlackRequest: async request => request,
        resolveSlackActor: async ({ teamId, userId }) => ({
            active: true,
            channel: 'slack',
            auth_user_id: `mapped:${teamId}:${userId}`,
            capabilities: ['analytics.read'],
        }),
        analysisService: { run: async invocation => { calls.push(invocation); return { status: 'ok' }; } },
    });
    const result = await adapter.run({
        verified: true,
        is_direct_message: true,
        team_id: 'T001',
        user_id: 'U001',
        operation: 'get_operation_summary',
        input: { period: { start: '2026-01-01', end_exclusive: '2026-02-01' } },
    });
    assert.deepEqual(result, { status: 'ok' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].actor.channel, 'slack');
    assert.equal(calls[0].operation, 'get_operation_summary');
});

await check('public channels and unsigned events are denied before identity or data lookup', async () => {
    let resolved = 0;
    const adapter = createSlackAnalysisAdapter({
        verifySlackRequest: async request => request,
        resolveSlackActor: async () => { resolved += 1; return null; },
        analysisService: { run: async () => ({}) },
    });
    await forbidden(adapter.run({ verified: true, is_direct_message: false, team_id: 'T001', user_id: 'U001' }));
    await forbidden(adapter.run({ verified: false, is_direct_message: true, team_id: 'T001', user_id: 'U001' }));
    assert.equal(resolved, 0);
});

await check('an unmapped or disabled Slack identity is denied without running analysis', async () => {
    let runs = 0;
    const adapter = createSlackAnalysisAdapter({
        verifySlackRequest: async request => request,
        resolveSlackActor: async () => ({ active: false, channel: 'slack' }),
        analysisService: { run: async () => { runs += 1; return {}; } },
    });
    await forbidden(adapter.run({ verified: true, is_direct_message: true, team_id: 'T001', user_id: 'U001' }));
    assert.equal(runs, 0);
});

console.log(`${passed} channel adapter checks passed`);
