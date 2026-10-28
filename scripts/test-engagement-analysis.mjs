import assert from 'node:assert/strict';
import { engagementFixture as fixture } from './fixtures/engagement-fixture.mjs';
import { calculateStatistics } from '../supabase/functions/_shared/operationStatistics/aggregate.mjs';
import { analyzeEngagement } from '../supabase/functions/_shared/operationStatistics/engagement.mjs';
import { periodWindow } from '../supabase/functions/_shared/operationStatistics/policy.mjs';
const now = new Date('2026-02-01T00:00:00+09:00'), window = periodWindow({ kind: 'month', date: '2026-01-01' });
const options = { window, asOf: now.toISOString(), followupDays: 30, comparisonDays: 28, attendanceBasis: 'confirmed' };
const result = analyzeEngagement(fixture, options);
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`ANALYSIS PASS ${name}`); };
check('specified visits 4 people / 7 days / 8 sessions / 305 minutes / median 45', () => {
    const stats = calculateStatistics(fixture, window, now);
    assert.equal(stats.visits.unique_visitors, 4); assert.equal(stats.visits.visitor_days, 7); assert.equal(stats.visits.visit_sessions, 8);
    assert.equal(stats.duration.valid_sessions, 7); assert.equal(stats.duration.complete_minutes, 305);
    assert.equal(stats.duration.mean_complete_minutes, 305 / 7); assert.equal(stats.duration.median_complete_minutes, 45); assert.equal(stats.duration.missing_checkout_sessions, 1);
});
check('signup attendance 2/3 / capacity 2/4 / wait and cancellation excluded', () => {
    const first = result.occurrence_rates.rows.find(row => row.program_ref === 'P1' && row.date === '2026-01-01');
    assert.equal(first.valid_preregistered, 3); assert.equal(first.attended, 2); assert.equal(first.applicant_attended, 2); assert.equal(first.applicant_attendance_rate, 2 / 3); assert.equal(first.capacity_utilization, 2 / 4);
    const walkin = result.occurrence_rates.rows.find(row => row.program_ref === 'P1' && row.date === '2026-01-08');
    assert.equal(walkin.attended, 1); assert.equal(walkin.valid_preregistered, 0); assert.equal(walkin.applicant_attendance_rate, null);
});
check('distinct programs per person; sessions are not distinct programs', () => {
    assert.equal(result.application_distribution.people, 4); assert.equal(result.application_distribution.one_program, 4);
    assert.equal(result.attendance_distribution.people, 3); assert.equal(result.attendance_distribution.one_program, 2); assert.equal(result.attendance_distribution.two_programs, 1);
});
check('same-program 30-day repetition 1/2 and censored D', () => {
    const p1 = result.program_retention.rows.find(row => row.program_ref === 'P1');
    assert.equal(p1.matured_people, 2); assert.equal(p1.censored_people, 1); assert.equal(p1.same_program_repeat_people, 1); assert.equal(p1.same_program_repeat_rate, 1 / 2);
});
check('center other-day revisits 2/3; same-day re-entry is not a revisit', () => {
    assert.equal(result.revisits.matured_people, 3); assert.equal(result.revisits.censored_people, 1); assert.equal(result.revisits.revisited_people, 2); assert.equal(result.revisits.revisit_rate, 2 / 3);
});
check('next OTHER program 1/2; repeat P1 skipped', () => {
    const p1 = result.program_retention.rows.find(row => row.program_ref === 'P1');
    assert.equal(p1.next_other_program_people, 1); assert.equal(p1.next_other_program_rate, 1 / 2);
    assert.deepEqual(result.flows.edges, [{ from_program: 'P1', to_program: 'P2', people: 1 }]);
});
check('paired 28-day visit days 1 to 1.5 / n2 / no causal claim', () => {
    assert.equal(result.before_after.paired_people, 2); assert.equal(result.before_after.censored_people, 1);
    assert.equal(result.before_after.before.visit_days, 2); assert.equal(result.before_after.after.visit_days, 3);
    assert.equal(result.before_after.mean_visit_days_before, 1); assert.equal(result.before_after.mean_visit_days_after, 1.5);
    assert.equal(result.before_after.inference, 'descriptive_only'); assert.equal(result.before_after.duration_comparison, 'incomplete'); assert.equal(result.before_after.delta.complete_minutes, null);
});
check('deduplication / joins and input order do not change results', () => {
    const copy = structuredClone(fixture); copy.datasets.logs = [...copy.datasets.logs.reverse(), copy.datasets.logs[0]];
    copy.datasets.sessionResponses = [...copy.datasets.sessionResponses.reverse(), copy.datasets.sessionResponses[0]];
    copy.datasets.sessions.reverse(); copy.datasets.users.reverse();
    assert.deepEqual(analyzeEngagement(copy, options), result);
    const conflicting = structuredClone(fixture); conflicting.datasets.logs.push({ ...conflicting.datasets.logs[0], type: 'MOVE' });
    assert.throws(() => analyzeEngagement(conflicting, options), /source_incomplete/);
});
check('unconfirmed attendance / missing origin / missing coverage not fabricated', () => {
    const copy = structuredClone(fixture); copy.datasets.sessionResponses[0].attendance_confirmed = false;
    assert.equal(analyzeEngagement(copy, options).attendance_distribution.status, 'unavailable');
    delete copy.datasets.sessionResponses[0].application_origin;
    assert.equal(analyzeEngagement(copy, options).occurrence_rates.status, 'unavailable');
    const incomplete = structuredClone(fixture); delete incomplete.coverage;
    assert.equal(analyzeEngagement(incomplete, options).revisits.status, 'unavailable');
    assert.equal(analyzeEngagement(incomplete, options).before_after.status, 'incomplete');
    const noHistory = structuredClone(fixture); noHistory.capabilities.stateAtOccurrence = false;
    assert.equal(analyzeEngagement(noHistory, options).occurrence_rates.status, 'unavailable');
});
check('same-day programs have no invented sequence', () => {
    const copy = structuredClone(fixture);
    copy.datasets.sessions.push({ id: 'same-day', notice_id: 'P2', session_date: '2026-01-01', status: 'OPEN', voided_at: null });
    copy.datasets.sessionResponses.push({ session_id: 'same-day', user_id: copy.datasets.users[0].id, status: 'JOIN', is_attended: true, attendance_confirmed: true, application_origin: 'WALK_IN' });
    const r = analyzeEngagement(copy, options); assert.equal(r.flows.same_day_ambiguous_people, 1);
    assert.equal(r.flows.edges.length, 1); // B remains the only ordered P1->P2 path.
});
check('KST midnight / negative and overlapping event quality', () => {
    const copy = structuredClone(fixture), user_id = copy.datasets.users[0].id;
    copy.datasets.logs.push({ id: 999, user_id, type: 'CHECKIN', location_id: 'room', created_at: '2026-01-01T01:30:00Z' });
    const overlap = calculateStatistics(copy, window, now); assert.equal(overlap.quality.overlapping_checkins, 1); assert.equal(overlap.duration.complete_minutes, 305);
    const negative = structuredClone(fixture); negative.datasets.logs = [{ id: 1, user_id, type: 'CHECKOUT', location_id: 'room', created_at: '2026-01-01T00:00:00Z' }, { id: 2, user_id, type: 'CHECKIN', location_id: 'room', created_at: '2026-01-01T01:00:00Z' }];
    assert.equal(calculateStatistics(negative, window, now).quality.orphan_checkouts, 1); assert.equal(calculateStatistics(negative, window, now).duration.complete_minutes, 0);
    const edge = structuredClone(fixture); edge.datasets.logs = [{ id: 1, user_id, type: 'CHECKIN', location_id: 'room', created_at: '2025-12-31T15:00:00Z' }];
    assert.equal(calculateStatistics(edge, window, now).visits.visit_sessions, 1);
});
check('internal joins never output people; publication remains separate', () => {
    assert.ok(!JSON.stringify(result).includes('synthetic-person')); assert.ok(!JSON.stringify(result).includes('user_id'));
    assert.equal(result.publication.status, 'review_required');
    const currentSchema = structuredClone(fixture); delete currentSchema.capabilities;
    for (const row of currentSchema.datasets.sessionResponses) { delete row.attendance_confirmed; delete row.application_origin; }
    const current = analyzeEngagement(currentSchema, options);
    assert.equal(current.attendance_distribution.status, 'unavailable'); assert.equal(current.application_distribution.status, 'limited');
    delete currentSchema.coverage;
    const recorded = analyzeEngagement(currentSchema, { ...options, attendanceBasis: 'recorded' });
    assert.equal(recorded.attendance_distribution.status, 'limited'); assert.equal(recorded.attendance_distribution.people, 3);
    assert.equal(recorded.flows.status, 'limited'); assert.equal(recorded.flows.edges[0].people, 1);
    assert.equal(recorded.revisits.status, 'unavailable'); // no invented followup denominator
});
console.log(`${checks} engagement acceptance checks passed (synthetic only)`);
