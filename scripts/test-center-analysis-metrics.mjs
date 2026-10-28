import assert from 'node:assert/strict';
import { createCenterAnalysisService } from '../supabase/functions/_shared/centerAnalysis/service.mjs';
import { createCenterAnalysisFixture, syntheticActor } from './fixtures/center-analysis/source-fixture.mjs';

const fixture = createCenterAnalysisFixture();
const repository = {
    readSnapshot: async () => structuredClone(fixture),
    listProgramCatalog: async () => [
        { program_ref: 'P1', title: '합성 프로그램 1', scheduled_date: '2026-01-01', recruitment_status: 'closed', public_description: null },
        { program_ref: 'P2', title: '합성 프로그램 2', scheduled_date: '2026-01-15', recruitment_status: 'closed', public_description: null },
    ],
};
const permissive = createCenterAnalysisService({ repository, now: () => new Date(fixture.as_of), requestId: () => 'synthetic-request', disclosurePolicy: { minimum_subjects: 1, maximum_contributor_share: 1 } });
const guarded = createCenterAnalysisService({ repository, now: () => new Date(fixture.as_of), requestId: () => 'synthetic-request', disclosurePolicy: { minimum_subjects: 5, maximum_contributor_share: 0.5 } });
let passed = 0;
const check = async (name, callback) => { await callback(); passed += 1; console.log(`CENTER ANALYSIS METRIC PASS ${name}`); };
const run = (service, operation, input) => service.run({ operation, input, actor: syntheticActor });

await check('summary preserves specified visit, duration, program, and operating totals', async () => {
    const output = await run(permissive, 'get_operation_summary', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' },
        domains: ['visits', 'duration', 'programs', 'feedback', 'rentals', 'store', 'surveys'],
    });
    const metrics = output.data.periods[0].metrics;
    assert.equal(output.status, 'ok');
    assert.equal(metrics.unique_visitors.value, 4);
    assert.equal(metrics.visitor_days.value, 7);
    assert.equal(metrics.visit_sessions.value, 8);
    assert.equal(metrics.recorded_minutes.value, 305);
    assert.equal(metrics.complete_duration_median.value, 45);
    assert.equal(metrics.recorded_attendance.value, 5);
    assert.equal(metrics.satisfaction_mean.value, 4);
    assert.equal(metrics.rental_bookings.value, 1);
    assert.equal(metrics.store_orders.value, 1);
    assert.equal(metrics.survey_submissions.value, 2);
});

await check('same definition supports equal-length comparison without personal rows', async () => {
    const output = await run(permissive, 'get_operation_summary', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, comparison: { kind: 'previous_equal_length' }, domains: ['visits'],
    });
    assert.equal(output.data.periods.length, 2);
    assert.equal(output.data.periods[0].period.start, '2026-01-01');
    assert.equal(output.data.periods[1].period.start, '2025-12-01');
    assert.equal(output.data.comparisons.find(row => row.metric_id === 'unique_visitors').absolute_change.value, 2);
    assert.equal(JSON.stringify(output).includes('synthetic-person'), false);
});

await check('recorded program engagement has distribution, transitions, and numeric satisfaction only', async () => {
    const output = await run(permissive, 'analyze_program_engagement', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' },
        breakdown: 'program',
        measures: ['applications', 'recorded_attendance', 'satisfaction', 'participation_distribution', 'transitions'],
    });
    const period = output.data.periods[0];
    assert.equal(period.totals.recorded_attendance.value, 5);
    assert.equal(period.totals.satisfaction_mean.value, 4);
    assert.equal(period.programs.length, 2);
    assert.deepEqual(period.participation_distribution.map(row => [row.bucket, row.people.value]), [['1', 2], ['2', 1], ['3_plus', 0]]);
    assert.deepEqual(period.transitions.map(row => [row.from_program_ref, row.to_program_ref, row.people.value]), [['P1', 'P2', 1]]);
});

await check('revisit denominator excludes observation-pending cohort members', async () => {
    const output = await run(permissive, 'analyze_revisits', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, cohort: 'visitors', followup_days: 30,
    });
    assert.equal(output.data.cohort_size.value, 4);
    assert.equal(output.data.observation_complete.value, 3);
    assert.equal(output.data.observation_pending.value, 1);
    assert.equal(output.data.revisited_people.value, 2);
    assert.equal(output.data.revisit_rate.value, 2 / 3);
});

await check('before-after keeps measure-specific paired denominators', async () => {
    const output = await run(permissive, 'analyze_program_visit_change', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, program_refs: ['P1'], window_days: 28,
    });
    const visitDays = output.data.changes.find(row => row.measure === 'visitor_days');
    const duration = output.data.changes.find(row => row.measure === 'measured_duration');
    assert.equal(visitDays.paired_people.value, 2);
    assert.equal(visitDays.before_mean.value, 1);
    assert.equal(visitDays.after_mean.value, 1.5);
    assert.equal(duration.paired_people.value, 0);
    assert.equal(duration.before_mean.value, null);
});

await check('unknown coverage keeps recorded returns visible without inventing a verified rate', async () => {
    const unknown = structuredClone(fixture); unknown.coverage = {};
    const service = createCenterAnalysisService({ repository: { readSnapshot: async () => unknown }, now: () => new Date(fixture.as_of), disclosurePolicy: { minimum_subjects: 1, maximum_contributor_share: 1 } });
    const output = await run(service, 'analyze_revisits', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, cohort: 'visitors', followup_days: 30 });
    assert.equal(output.data.revisit_rate.value, null);
    assert.equal(output.data.recorded_revisited_people.value, 2);
    assert.equal(output.data.recorded_revisit_rate.value, 2 / 3);
    assert.equal(output.data.observation_pending.value, 1);
    assert.equal(output.data.self_reported_unprompted_revisited_people.value, null);
    assert.ok(output.warnings.some(row => row.code === 'recorded_visits_only'));
    const change = await run(service, 'analyze_program_visit_change', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, program_refs: ['P1'], window_days: 28 });
    const days = change.data.changes.find(row => row.measure === 'visitor_days');
    assert.equal(days.paired_people.value, 0);
    assert.equal(days.recorded_paired_people.value, 2);
    assert.equal(days.recorded_after_mean.value, 1.5);
});

await check('future follow-up remains pending even if coverage metadata extends into the future', async () => {
    const output = await run(permissive, 'analyze_program_visit_change', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, program_refs: ['P2'], window_days: 28 });
    assert.ok(output.data.observation_pending.value > 0);
    assert.equal(output.data.changes.find(row => row.measure === 'visitor_days').recorded_paired_people.value, 0);
});

await check('self-reported initiative requires both fixed answers and conflicting answers stay unknown', async () => {
    const evidence = structuredClone(fixture);
    evidence.datasets.visitInitiative = [
        { user_id:'synthetic-person-A',visited_at:'2026-01-22T10:00:00+09:00',purpose:'free_use',teacher_contact:'no' },
        { user_id:'synthetic-person-B',visited_at:'2026-01-15T10:00:00+09:00',purpose:'program',teacher_contact:'no' },
    ];
    const service = createCenterAnalysisService({repository:{readSnapshot:async()=>evidence},now:()=>new Date(fixture.as_of),disclosurePolicy:{minimum_subjects:1,maximum_contributor_share:1}});
    const input = {period:{start:'2026-01-01',end_exclusive:'2026-02-01'},cohort:'visitors',followup_days:30};
    let output = await run(service,'analyze_revisits',input);
    assert.equal(output.data.initiative_respondents.value,2);
    assert.equal(output.data.self_reported_unprompted_revisited_people.value,1);
    evidence.datasets.visitInitiative.push({user_id:'synthetic-person-A',visited_at:'2026-01-22T11:00:00+09:00',purpose:'free_use',teacher_contact:'yes'});
    output = await run(service,'analyze_revisits',input);
    assert.equal(output.data.initiative_respondents.value,1);
    assert.equal(output.data.self_reported_unprompted_revisited_people.value,0);
    const guardedEvidence = createCenterAnalysisService({repository:{readSnapshot:async()=>evidence},now:()=>new Date(fixture.as_of),disclosurePolicy:{minimum_subjects:2,maximum_contributor_share:1}});
    output = await run(guardedEvidence,'analyze_revisits',input);
    assert.equal(output.data.initiative_respondents.status,'suppressed');
    assert.equal(output.data.self_reported_unprompted_revisited_people.value,null);
});

await check('default small-cohort policy suppresses rather than exposes a person-level result', async () => {
    const output = await run(guarded, 'analyze_revisits', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, cohort: 'visitors', followup_days: 30,
    });
    assert.equal(output.status, 'unavailable');
    assert.equal(output.data.revisit_rate.status, 'suppressed');
    assert.equal(output.data.revisit_rate.value, null);
});

await check('authentication is a server dependency and not an input field', async () => {
    const output = await permissive.run({ operation: 'get_metric_definitions', input: {}, actor: { active: true, capabilities: [] } });
    assert.equal(output.status, 'unavailable');
    assert.equal(output.error.code, 'forbidden');
});

console.log(`${passed} center analysis metric checks passed`);
