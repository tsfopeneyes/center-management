import assert from 'node:assert/strict';
import {
    AnalysisError,
    makeAnalysisResult,
    parseOperationInput,
    previousPeriod,
    validDay,
} from '../supabase/functions/_shared/centerAnalysis/contracts.mjs';
import { definitionsFor, METRIC_DEFINITIONS, operationCapabilities } from '../supabase/functions/_shared/centerAnalysis/definitions.mjs';

const now = new Date('2026-02-01T00:00:00+09:00');
let passed = 0;
const check = (name, callback) => { callback(); passed += 1; console.log(`CENTER ANALYSIS CONTRACT PASS ${name}`); };
const invalid = callback => assert.throws(callback, error => error instanceof AnalysisError && error.code === 'invalid_input');

check('date format is calendar-valid', () => {
    assert.equal(validDay('2026-02-28'), true);
    assert.equal(validDay('2026-02-30'), false);
    assert.equal(validDay('2026/02/01'), false);
});

check('summary only accepts fixed domains and canonicalizes order', () => {
    const request = parseOperationInput('get_operation_summary', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' },
        domains: ['store', 'visits'],
    }, { now });
    assert.deepEqual(request.domains, ['visits', 'store']);
    assert.equal(request.comparison, null);
});

check('comparison periods are exact and future periods are denied', () => {
    const request = parseOperationInput('get_operation_summary', {
        period: { start: '2026-01-01', end_exclusive: '2026-02-01' },
        comparison: { kind: 'previous_equal_length' },
    }, { now });
    assert.deepEqual(previousPeriod(request.period, request.comparison), { start: '2025-12-01', end_exclusive: '2026-01-01' });
    invalid(() => parseOperationInput('get_operation_summary', { period: { start: '2026-02-02', end_exclusive: '2026-02-03' } }, { now }));
    invalid(() => parseOperationInput('get_operation_summary', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, comparison: { kind: 'previous_calendar_period', unit: 'week' } }, { now }));
});

check('free SQL, person filters, arbitrary fields, and invalid program references are rejected', () => {
    invalid(() => parseOperationInput('get_operation_summary', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, sql: 'select * from users' }, { now }));
    invalid(() => parseOperationInput('analyze_revisits', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, cohort: 'visitors', followup_days: 7, user_id: 'x' }, { now }));
    invalid(() => parseOperationInput('analyze_program_engagement', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, breakdown: 'program', program_refs: ['P1', 'P1'] }, { now }));
    invalid(() => parseOperationInput('analyze_program_visit_change', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, program_refs: ['P1;DROP'], window_days: 7 }, { now }));
});

check('cohort contracts require explicit, bounded observation choices', () => {
    invalid(() => parseOperationInput('analyze_revisits', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, cohort: 'program_attendees', followup_days: 7 }, { now }));
    const request = parseOperationInput('analyze_program_visit_change', { period: { start: '2026-01-01', end_exclusive: '2026-02-01' }, program_refs: ['P1'], window_days: 28 }, { now });
    assert.deepEqual(request.measures, ['visitor_days', 'visit_sessions', 'measured_duration']);
});

check('registry and advertised operations remain in one fixed contract', () => {
    assert.ok(Object.keys(METRIC_DEFINITIONS).includes('revisit_rate'));
    assert.deepEqual(definitionsFor(['visit_sessions']).map(row => row.metric_id), ['visit_sessions']);
    assert.equal(operationCapabilities().length, 7);
    assert.ok(operationCapabilities().every(row => typeof row.name === 'string'));
});

check('public analysis responses have a hard byte limit instead of silently truncating', () => {
    assert.throws(() => makeAnalysisResult({
        requestId: 'test-request',
        status: 'ok',
        asOf: '2026-02-01T00:00:00.000Z',
        data: { summary: 'a'.repeat(128 * 1024) },
    }), error => error instanceof AnalysisError && error.code === 'analysis_too_large');
});

console.log(`${passed} center analysis contract checks passed`);
