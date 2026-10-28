import assert from 'node:assert/strict';
import { satisfactionContext } from '../supabase/functions/_shared/centerAnalysis/operatingContext.mjs';
import { createCenterAnalysisService } from '../supabase/functions/_shared/centerAnalysis/service.mjs';
const period = { start: '2026-09-07', end_exclusive: '2026-10-07' };
const metric = value => ({ satisfaction_response_count: { status: 'available', value } });
const row = { domain: 'feedback', ...period, activity_status: 'not_conducted', evidence: 'operator_report' };
assert.equal(satisfactionContext({}, period, metric(0)).activity_status, 'unknown');
assert.equal(satisfactionContext({ operating_context: [row] }, period, metric(0)).activity_status, 'not_conducted');
assert.equal(satisfactionContext({ operating_context: [row] }, { start: '2026-08-08', end_exclusive: '2026-09-07' }, metric(0)).activity_status, 'unknown');
assert.equal(satisfactionContext({ operating_context: [{ ...row, end_exclusive: '2026-09-20' }] }, period, metric(0)).activity_status, 'unknown');
assert.equal(satisfactionContext({ operating_context: [row] }, period, metric(2)).activity_status, 'conflicting_evidence');
assert.equal(satisfactionContext({}, period, metric(2)).activity_status, 'responses_recorded');
assert.equal(satisfactionContext({ operating_context: [row, { ...row, activity_status: 'conducted' }] }, period, metric(0)).activity_status, 'conflicting_evidence');
console.log('PASS seven context checks: unknown, reported non-conduct, period isolation, partial coverage, response conflicts, observed responses, report conflicts');
const datasets = Object.fromEntries(['users','staff','locations','logs','notices','responses','sessions','sessionResponses','openAttendance','migratedProgramRefs','satisfactionResponses','rentalBookings','storeOrders','checkinSurveys'].map(name => [name, []]));
const service = createCenterAnalysisService({ repository: { readSnapshot: async () => ({ complete: true, as_of: '2026-10-07T03:00:00Z', datasets, operating_context: [row] }) }, now: () => new Date('2026-10-07T03:00:00Z') });
for (const [operation, input] of [
    ['get_operation_summary', { period, domains: ['feedback'] }],
    ['analyze_program_engagement', { period, breakdown: 'none', measures: ['satisfaction'] }],
]) {
    const result = await service.run({ operation, input, actor: { active: true, capabilities: ['analytics.read'] } });
    assert.equal(result.data.periods[0].operating_context.activity_status, 'not_conducted');
}
console.log('PASS both public analysis operations return persisted context');
