import assert from 'node:assert/strict';
import { parseOperationInput } from '../supabase/functions/_shared/centerAnalysis/contracts.mjs';
import { createCenterAnalysisService } from '../supabase/functions/_shared/centerAnalysis/service.mjs';
import { createPostgresAnalysisRepository } from '../supabase/functions/_shared/centerAnalysis/postgresRepository.mjs';

const period = { start: '2026-07-01', end_exclusive: '2026-10-01' };
const actor = { active: true, capabilities: ['analytics.read', 'programs.read'] };
const fixture = {
    complete: true, as_of: '2026-10-08T00:00:00Z', coverage: {},
    approved_programs: [{ program_ref: 'H', title: '하이픈 프로그램' }, { program_ref: 'E', title: '이높 프로그램' }],
    datasets: {
        users: [{ id: 'a', user_group: 'STUDENT' }, { id: 'b', user_group: 'STUDENT' }], staff: [],
        locations: [{ id: 'h', site: 'HAIFN' }, { id: 'e', site: 'ENOUGH_PLACE' }, { id: 'u', site: null }],
        logs: [
            ['1', 'a', 'CHECKIN', 'h', '07-01T10:00'], ['2', 'a', 'MOVE', 'e', '07-01T11:00'], ['3', 'a', 'CHECKOUT', 'e', '07-01T12:00'],
            ['4', 'a', 'CHECKIN', 'e', '07-03T10:00'], ['5', 'a', 'CHECKOUT', 'e', '07-03T11:00'],
            ['6', 'b', 'CHECKIN', 'e', '07-01T10:00'], ['7', 'b', 'CHECKOUT', 'e', '07-01T11:00'],
        ].map(([id, user_id, type, location_id, time]) => ({ id, user_id, type, location_id, created_at: `2026-${time}:00+09:00` })),
        notices: [
            { id: 'H', site: 'HAIFN' }, { id: 'E', site: 'ENOUGH_PLACE' }, { id: 'U', site: null },
        ].map(row => ({ ...row, category: 'PROGRAM', program_date: '2026-07-01', created_at: '2026-07-01T00:00:00Z', program_status: 'OPEN', is_recruiting: true })),
        responses: [
            { notice_id: 'H', user_id: 'a' }, { notice_id: 'E', user_id: 'b' }, { notice_id: 'U', user_id: 'a' },
        ].map(row => ({ ...row, status: 'JOIN', is_attended: true, is_staff: false })),
        sessions: [], sessionResponses: [], openAttendance: [], migratedProgramRefs: [], satisfactionResponses: [],
        rentalBookings: [{ id: 'r1', booking_date: '2026-07-01', status: 'CONFIRMED', site: 'HAIFN' }, { id: 'r2', booking_date: '2026-07-01', status: 'CONFIRMED', site: 'ENOUGH_PLACE' }],
        checkinSurveys: [], storeOrders: [{ id: 's', created_at: '2026-07-01T00:00:00Z', status: 'APPROVED' }],
    },
};
const service = createCenterAnalysisService({
    repository: { readSnapshot: async () => structuredClone(fixture) }, now: () => new Date(fixture.as_of),
    disclosurePolicy: { minimum_subjects: 1, maximum_contributor_share: 1 },
});
const run = (operation, input) => service.run({ operation, input, actor });
const summary = site => run('get_operation_summary', { period, ...(site ? { site } : {}), domains: ['visits', 'duration', 'programs', 'rentals', 'store'] });
const metric = (output, id) => output.data.periods[0].metrics[id];
const h = await summary('HAIFN'); const e = await summary('ENOUGH_PLACE'); const all = await summary();
assert.equal(metric(h, 'unique_visitors').value, 1);
assert.equal(metric(e, 'unique_visitors').value, 2);
assert.equal(metric(all, 'unique_visitors').value, 2);
assert.equal(metric(h, 'recorded_minutes').value, 60);
assert.equal(metric(e, 'recorded_minutes').value, 180);
assert.equal(metric(all, 'recorded_minutes').value, 240);
assert.equal(metric(h, 'recorded_attendance').value, 1);
assert.equal(metric(all, 'recorded_attendance').value, 3);
assert.equal(metric(h, 'rental_bookings').value, 1);
assert.equal(metric(h, 'store_orders').status, 'unavailable');
assert.equal(h.data.scope.site, 'HAIFN');
assert.equal(h.data.scope.unclassified_source_rows.notices, 1);
assert.ok(h.warnings.some(row => row.code === 'site_attribution_incomplete'));
console.log('PASS center visits, cross-center move duration, programs, rental attribution, unknown exclusions and default totals');

const revisit = await run('analyze_revisits', { period, site: 'HAIFN', cohort: 'visitors', followup_days: 7 });
assert.equal(revisit.data.recorded_revisited_people.value, 0, 'an ENOUGH return must never count as a HAIFN return');
const allRevisit = await run('analyze_revisits', { period, cohort: 'visitors', followup_days: 7 });
assert.equal(allRevisit.data.recorded_revisited_people.value, 1);
console.log('PASS full 92-day quarter and site-specific follow-up');

const change = await run('analyze_program_visit_change', { period, site: 'HAIFN', program_refs: ['H'], window_days: 7 });
assert.notEqual(change.status, 'error');
assert.equal(change.data.cohort_size.value, 1);
const foreign = await run('analyze_program_visit_change', { period, site: 'HAIFN', program_refs: ['E'], window_days: 7 });
assert.equal(foreign.data.cohort_size.value, 0);
const engagement = await run('analyze_program_engagement', { period, site: 'HAIFN', breakdown: 'program', measures: ['recorded_attendance'] });
assert.equal(engagement.data.periods[0].totals.recorded_attendance.value, 1);
console.log('PASS program cohort and engagement retain the same site scope');

assert.equal(parseOperationInput('get_program_catalog', { site: 'HAIFN' }).site, 'HAIFN');
for (const site of ['haifn', 'anything', null, "HAIFN';DROP TABLE users"]) {
    assert.throws(() => parseOperationInput('get_operation_summary', { period, site }, { now: new Date(fixture.as_of) }), error => error.code === 'invalid_input');
}
assert.throws(() => parseOperationInput('analyze_revisits', { period: { start: '2026-06-30', end_exclusive: '2026-10-01' }, cohort: 'visitors', followup_days: 7 }, { now: new Date(fixture.as_of) }), error => error.code === 'invalid_input');
console.log('PASS fixed site allow-list and bounded quarter contract');

let catalogQuery;
const repository = createPostgresAnalysisRepository({ pool: { connect: async () => ({
    query: async (sql, values) => {
        if (sql.includes('SELECT current_user AS role')) return { rows: [{ role: 'center_integration_reader' }] };
        if (sql.includes('program_catalog')) catalogQuery = { sql, values };
        return { rows: [] };
    }, release() {},
}) } });
await repository.listProgramCatalog({ site: 'HAIFN', limit: 20 });
assert.match(catalogQuery.sql, /n.site=\$5::text/);
assert.equal(catalogQuery.values[4], 'HAIFN');
console.log('PASS catalog binds the same site filter without raw-source grants');

const incomplete = structuredClone(fixture); delete incomplete.datasets.locations[0].site;
const broken = createCenterAnalysisService({ repository: { readSnapshot: async () => incomplete }, now: () => new Date(fixture.as_of) });
const failed = await broken.run({ operation: 'get_operation_summary', input: { period, site: 'HAIFN' }, actor });
assert.equal(failed.status, 'unavailable');
assert.equal(failed.error.code, 'source_incomplete');
console.log('PASS missing attribution fails closed instead of returning a false zero');
