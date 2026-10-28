import assert from 'node:assert/strict';
import { parseOperationInput } from '../supabase/functions/_shared/centerAnalysis/contracts.mjs';
import { createPostgresAnalysisRepository, sourceScopeFor } from '../supabase/functions/_shared/centerAnalysis/postgresRepository.mjs';

const queryLog = [];
const resultFor = sql => {
    if (/program_catalog/.test(sql)) return { rows: [{ program_ref: 'P1', title: '합성 프로그램', scheduled_date: '2026-01-10', recruitment_status: 'closed', public_description: null }] };
    if (/SELECT current_user AS role/.test(sql)) return { rows: [{ role: 'center_integration_reader' }] };
    if (/clock_timestamp/.test(sql)) return { rows: [{ as_of: '2026-02-01T00:00:00.000Z' }] };
    if (/source_coverage/.test(sql)) return { rows: [
        { domain: 'logs', status: 'complete', start: '2025-12-01', end_exclusive: '2026-03-01', reason: null },
        { domain: 'programs', status: 'complete', start: '2025-12-01', end_exclusive: '2026-03-01', reason: null },
    ] };
    if (/analysis_users/.test(sql)) return { rows: [{ id: 'user-a', user_group: 'STUDENT' }] };
    if (/analysis_staff/.test(sql)) return { rows: [] };
    if (/analysis_locations/.test(sql)) return { rows: [{ id: 'room-a' }] };
    if (/analysis_logs/.test(sql)) return { rows: [{ id: 'log-a', user_id: 'user-a', type: 'CHECKIN', location_id: 'room-a', created_at: '2026-01-10T01:00:00.000Z' }] };
    if (/analysis_notices/.test(sql)) return { rows: [{ id: 'P1', category: 'PROGRAM', program_date: '2026-01-10', created_at: '2026-01-01T00:00:00.000Z', program_status: 'OPEN', is_recruiting: true }] };
    if (/DISTINCT ps\.notice_id/.test(sql)) return { rows: [] };
    if (/analysis_notice_responses/.test(sql)) return { rows: [{ notice_id: 'P1', user_id: 'user-a', status: 'JOIN', is_attended: true, is_staff: false }] };
    if (/analysis_program_sessions ps/.test(sql)) return { rows: [] };
    if (/analysis_open_program_attendance/.test(sql)) return { rows: [] };
    if (/analysis_satisfaction_facts/.test(sql)) return { rows: [{ id: 'rating-a', program_ref: 'P1', value: 5, submitted_at: '2026-01-10T12:00:00.000Z' }] };
    if (/analysis_rental_bookings/.test(sql)) return { rows: [{ id: 'rental-a', booking_date: '2026-01-11', status: 'CONFIRMED' }] };
    if (/analysis_store_orders/.test(sql)) return { rows: [{ id: 'store-a', created_at: '2026-01-12T00:00:00.000Z', status: 'APPROVED' }] };
    if (/analysis_checkin_surveys/.test(sql)) return { rows: [{ id: 'survey-a', created_at: '2026-01-13T00:00:00.000Z', survey_type: 'CHECKIN' }] };
    if (/program_catalog/.test(sql)) return { rows: [{ program_ref: 'P1', title: '합성 프로그램', scheduled_date: '2026-01-10', recruitment_status: 'closed', public_description: null }] };
    return { rows: [] };
};

const pool = {
    async connect() {
        return {
            async query(sql, values) { queryLog.push({ sql, values }); return resultFor(sql); },
            release() {},
        };
    },
};

const now = new Date('2026-02-01T00:00:00.000Z');
const request = parseOperationInput('get_operation_summary', {
    period: { start: '2026-01-01', end_exclusive: '2026-02-01' },
    domains: ['visits', 'programs', 'feedback', 'rentals', 'store', 'surveys'],
}, { now });
const repository = createPostgresAnalysisRepository({ pool });
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`CENTER REPOSITORY PASS ${name}`); };

await check('scope expansion is fixed by operation and cannot become an arbitrary history query', async () => {
    const beforeAfter = sourceScopeFor('analyze_program_visit_change', parseOperationInput('analyze_program_visit_change', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, program_refs: ['P1'], window_days: 7,
    }, { now }));
    assert.deepEqual(beforeAfter.visits, { start: '2025-12-25', end_exclusive: '2026-02-08' });
    const revisits = sourceScopeFor('analyze_revisits', parseOperationInput('analyze_revisits', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, cohort: 'visitors', followup_days: 30,
    }, { now }));
    assert.deepEqual(revisits.visits, { start: '2026-01-01', end_exclusive: '2026-03-03' });
});

await check('snapshot reads only fixed private fact views with a repeatable read role boundary', async () => {
    const snapshot = await repository.readSnapshot({ operation: 'get_operation_summary', request });
    assert.equal(snapshot.complete, true);
    assert.equal(snapshot.as_of, '2026-02-01T00:00:00.000Z');
    assert.deepEqual(snapshot.datasets.logs, [{ id: 'log-a', user_id: 'user-a', type: 'CHECKIN', location_id: 'room-a', created_at: '2026-01-10T01:00:00.000Z' }]);
    assert.deepEqual(snapshot.datasets.satisfactionResponses, [{ id: 'rating-a', program_ref: 'P1', value: 5, submitted_at: '2026-01-10T12:00:00.000Z' }]);
    const sourceQueries = queryLog.filter(item => /FROM center_integration\./.test(item.sql));
    assert.ok(sourceQueries.length >= 10);
    assert.ok(sourceQueries.every(item => !/\bpublic\./i.test(item.sql) && !/\bOFFSET\b/i.test(item.sql) && /\bLIMIT \$\d+/.test(item.sql)));
    assert.ok(sourceQueries.filter(item => /analysis_(users|staff|locations)/.test(item.sql)).every(item => /ANY\(\$1::text\[\]\)/.test(item.sql)));
    const noticesQuery = sourceQueries.find(item => /analysis_notices/.test(item.sql));
    assert.ok(noticesQuery);
    assert.match(noticesQuery.sql, /n\.program_date >= \$1::timestamptz/);
    assert.deepEqual(noticesQuery.values.slice(0, 5), [
        '2026-01-01T00:00:00+09:00',
        '2026-02-01T00:00:00+09:00',
        null,
        '2026-01-01',
        '2026-02-01',
    ]);
    assert.ok(queryLog.some(item => /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/.test(item.sql)));
    assert.ok(queryLog.some(item => /SET LOCAL ROLE "center_integration_reader"/.test(item.sql)));
});

await check('approved catalog data is read from its separate allow-listed relation', async () => {
    const catalog = await repository.listProgramCatalog(parseOperationInput('get_program_catalog', { limit: 20 }, { now }));
    assert.deepEqual(catalog, [{ program_ref: 'P1', title: '합성 프로그램', scheduled_date: '2026-01-10', recruitment_status: 'closed', public_description: null }]);
    assert.ok(queryLog.some(item => /program_catalog/.test(item.sql) && /published IS TRUE/.test(item.sql)));
});

await check('revisit follow-up reads all programs without querying the removed survey projection', async () => {
    const offset = queryLog.length;
    const revisit = parseOperationInput('analyze_revisits', {period:{start:'2026-01-01',end_exclusive:'2026-02-01'},cohort:'program_attendees',program_refs:['P1'],followup_days:7},{now});
    const snapshot = await repository.readSnapshot({operation:'analyze_revisits',request:revisit});
    assert.equal(snapshot.datasets.visitInitiative,undefined);
    const queries = queryLog.slice(offset);
    const programs = queries.find(row => /analysis_notices/.test(row.sql));
    assert.equal(programs.values[2],null,'other programs must be included when classifying return days');
    assert.equal(programs.values[4],'2026-02-08');
    const initiative = queries.find(row => /analysis_visit_initiative/.test(row.sql));
    assert.equal(initiative,undefined);
});

await check('the source budget rejects a partial fact stream instead of truncating it', async () => {
    const limited = createPostgresAnalysisRepository({ pool, sourceRowLimit: 1 });
    await assert.rejects(() => limited.readSnapshot({ operation: 'get_analysis_capabilities', request: {} }), error => error.code === 'analysis_too_large');
});

console.log(`${passed} repository checks passed`);
