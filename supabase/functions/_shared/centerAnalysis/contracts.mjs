import { normalizeSite } from './site.mjs';
// Shared, transport-independent contract for center analysis.  This module is
// deliberately dependency-free so the same validation runs in Deno, Node tests,
// the web adapter, Slack, and the MCP adapter.

export const SCHEMA_VERSION = 'center-analysis.v1';
export const DEFINITION_VERSION = '2026-10-v1';
export const TIMEZONE = 'Asia/Seoul';
export const MAX_PUBLIC_RESPONSE_BYTES = 128 * 1024;

export const OPERATION_NAMES = Object.freeze([
    'get_analysis_capabilities',
    'get_operation_summary',
    'get_program_catalog',
    'analyze_program_engagement',
    'analyze_revisits',
    'analyze_program_visit_change',
    'get_metric_definitions',
]);

export const DOMAIN_NAMES = Object.freeze([
    'visits', 'duration', 'programs', 'feedback', 'rentals', 'store', 'surveys',
]);

export const METRIC_UNITS = Object.freeze([
    'people', 'sessions', 'days', 'minutes', 'count', 'points', 'ratio', 'rating',
]);

export const ERROR_CODES = Object.freeze([
    'invalid_input', 'unauthenticated', 'forbidden', 'connection_revoked', 'not_configured',
    'source_incomplete', 'unsupported_metric', 'observation_incomplete', 'privacy_suppressed',
    'rate_limited', 'analysis_too_large', 'timeout', 'temporarily_unavailable',
]);

export class AnalysisError extends Error {
    constructor(code = 'temporarily_unavailable', { retryable = false, message } = {}) {
        super(message || code);
        this.name = 'AnalysisError';
        this.code = ERROR_CODES.includes(code) ? code : 'temporarily_unavailable';
        this.retryable = retryable;
    }
}

export const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export const failInput = () => { throw new AnalysisError('invalid_input'); };

const assertPlainObject = value => {
    if (!isPlainObject(value)) failInput();
    return value;
};

const assertKeys = (value, allowed, required = []) => {
    assertPlainObject(value);
    if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) failInput();
};

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const hasValidInteger = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export const validDay = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const shiftDay = (day, days) => {
    if (!validDay(day) || !Number.isSafeInteger(days)) throw new AnalysisError('invalid_input');
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

export const daysBetween = (start, endExclusive) => {
    if (!validDay(start) || !validDay(endExclusive) || start >= endExclusive) failInput();
    return Math.round((Date.parse(`${endExclusive}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000);
};

export const kstDay = value => {
    const instant = value instanceof Date ? value.getTime() : Date.parse(value);
    if (!Number.isFinite(instant)) throw new AnalysisError('source_incomplete');
    return new Date(instant + 9 * 3_600_000).toISOString().slice(0, 10);
};

export const kstStart = day => {
    if (!validDay(day)) failInput();
    return `${day}T00:00:00+09:00`;
};

export const kstNowDay = (now = new Date()) => kstDay(now);

export function normalizedPeriod(value, { now = new Date(), maxDays = 366 } = {}) {
    assertKeys(value, ['start', 'end_exclusive'], ['start', 'end_exclusive']);
    if (!validDay(value.start) || !validDay(value.end_exclusive)) failInput();
    const length = daysBetween(value.start, value.end_exclusive);
    const today = kstNowDay(now);
    if (value.start > today || value.end_exclusive > shiftDay(today, 1) || length > maxDays) failInput();
    return Object.freeze({ start: value.start, end_exclusive: value.end_exclusive });
}

const monday = day => new Date(`${day}T00:00:00.000Z`).getUTCDay() === 1;
const firstDayOfMonth = day => day.slice(8) === '01';
const exactMonth = period => firstDayOfMonth(period.start)
    && period.end_exclusive === shiftMonth(period.start, 1);

const shiftMonth = (day, months) => {
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
};

function normalizedComparison(value, period) {
    if (value == null) return null;
    assertKeys(value, ['kind', 'unit'], ['kind']);
    if (value.kind === 'previous_equal_length' && !Object.hasOwn(value, 'unit')) return Object.freeze({ kind: value.kind });
    if (value.kind !== 'previous_calendar_period' || !['week', 'month'].includes(value.unit)) failInput();
    if (value.unit === 'week' && (!monday(period.start) || daysBetween(period.start, period.end_exclusive) !== 7)) failInput();
    if (value.unit === 'month' && !exactMonth(period)) failInput();
    return Object.freeze({ kind: value.kind, unit: value.unit });
}

export function previousPeriod(period, comparison) {
    if (!comparison) return null;
    if (comparison.kind === 'previous_equal_length') {
        const length = daysBetween(period.start, period.end_exclusive);
        return Object.freeze({ start: shiftDay(period.start, -length), end_exclusive: period.start });
    }
    if (comparison.unit === 'week') return Object.freeze({ start: shiftDay(period.start, -7), end_exclusive: period.start });
    return Object.freeze({ start: shiftMonth(period.start, -1), end_exclusive: period.start });
}

const normalizeString = (value, maximum) => {
    if (typeof value !== 'string' || value.length > maximum || value.includes('\u0000')) failInput();
    return value.trim();
};

function programRefs(value, { required = false } = {}) {
    if (value == null) {
        if (required) failInput();
        return null;
    }
    if (!Array.isArray(value) || value.length < 1 || value.length > 20) failInput();
    const refs = value.map(ref => {
        const normalized = normalizeString(ref, 64);
        if (!normalized || !/^[A-Za-z0-9._:-]+$/.test(normalized)) failInput();
        return normalized;
    });
    if (new Set(refs).size !== refs.length) failInput();
    return Object.freeze(refs);
}

function enumArray(value, allowed, { defaultValue = null, max = allowed.length } = {}) {
    if (value == null) return defaultValue == null ? null : Object.freeze([...defaultValue]);
    if (!Array.isArray(value) || !value.length || value.length > max || value.some(item => !allowed.includes(item)) || new Set(value).size !== value.length) failInput();
    return Object.freeze(allowed.filter(item => value.includes(item)));
}

function commonQuery(input, { maxDays = 366, now = new Date() } = {}) {
    const period = normalizedPeriod(input.period, { maxDays, now });
    return Object.freeze({ period, comparison: normalizedComparison(input.comparison, period), site: normalizeSite(input.site) });
}

function parseOperationSummary(input, now) {
    assertKeys(input, ['period', 'comparison', 'domains', 'site'], ['period']);
    const common = commonQuery(input, { now });
    const domains = enumArray(input.domains, DOMAIN_NAMES, { defaultValue: ['visits', 'duration', 'programs'], max: DOMAIN_NAMES.length });
    return Object.freeze({ ...common, domains });
}

function parseCatalog(input, now) {
    assertKeys(input, ['query', 'period', 'limit', 'site']);
    const query = input.query == null ? null : normalizeString(input.query, 100);
    const period = input.period == null ? null : normalizedPeriod(input.period, { now });
    const limit = input.limit == null ? 20 : input.limit;
    if (!hasValidInteger(limit, 1, 20)) failInput();
    return Object.freeze({ query: query || null, period, limit, site: normalizeSite(input.site) });
}

function parseProgramEngagement(input, now) {
    assertKeys(input, ['period', 'comparison', 'program_refs', 'breakdown', 'measures', 'site'], ['period', 'breakdown']);
    const common = commonQuery(input, { now });
    if (!['none', 'program'].includes(input.breakdown)) failInput();
    const measures = enumArray(input.measures,
        ['applications', 'recorded_attendance', 'satisfaction', 'participation_distribution', 'transitions'],
        { defaultValue: ['applications', 'recorded_attendance', 'satisfaction'] });
    return Object.freeze({ ...common, program_refs: programRefs(input.program_refs), breakdown: input.breakdown, measures });
}

function parseRevisits(input, now) {
    assertKeys(input, ['period', 'cohort', 'program_refs', 'followup_days', 'site'], ['period', 'cohort', 'followup_days']);
    const period = normalizedPeriod(input.period, { maxDays: 92, now });
    if (!['visitors', 'program_attendees'].includes(input.cohort) || ![7, 14, 30].includes(input.followup_days)) failInput();
    const refs = programRefs(input.program_refs, { required: input.cohort === 'program_attendees' });
    if (input.cohort === 'visitors' && refs) failInput();
    return Object.freeze({ period, site: normalizeSite(input.site), cohort: input.cohort, program_refs: refs, followup_days: input.followup_days });
}

function parseProgramVisitChange(input, now) {
    assertKeys(input, ['period', 'program_refs', 'window_days', 'measures', 'site'], ['period', 'program_refs', 'window_days']);
    const period = normalizedPeriod(input.period, { maxDays: 92, now });
    if (![7, 14, 28, 30].includes(input.window_days)) failInput();
    const measures = enumArray(input.measures, ['visitor_days', 'visit_sessions', 'measured_duration'],
        { defaultValue: ['visitor_days', 'visit_sessions', 'measured_duration'] });
    return Object.freeze({ period, site: normalizeSite(input.site), program_refs: programRefs(input.program_refs, { required: true }), window_days: input.window_days, measures });
}

function parseMetricDefinitions(input) {
    assertKeys(input, ['metric_ids']);
    if (input.metric_ids == null) return Object.freeze({ metric_ids: null });
    if (!Array.isArray(input.metric_ids) || !input.metric_ids.length || input.metric_ids.length > 30) failInput();
    const metricIds = input.metric_ids.map(metricId => {
        const normalized = normalizeString(metricId, 64);
        if (!/^[a-z][a-z0-9_]*$/.test(normalized)) failInput();
        return normalized;
    });
    if (new Set(metricIds).size !== metricIds.length) failInput();
    return Object.freeze({ metric_ids: Object.freeze(metricIds) });
}

export function parseOperationInput(operation, input, { now = new Date() } = {}) {
    if (!OPERATION_NAMES.includes(operation)) throw new AnalysisError('invalid_input');
    assertPlainObject(input);
    // Date validation is deterministic for an individual invocation. The parser
    // cannot allow callers to pick the server's reference clock.
    if (operation === 'get_analysis_capabilities') {
        assertKeys(input, []); return Object.freeze({});
    }
    if (operation === 'get_program_catalog') return parseCatalog(input, now);
    if (operation === 'get_metric_definitions') return parseMetricDefinitions(input);
    if (operation === 'get_operation_summary') return parseOperationSummary(input, now);
    if (operation === 'analyze_program_engagement') return parseProgramEngagement(input, now);
    if (operation === 'analyze_revisits') return parseRevisits(input, now);
    return parseProgramVisitChange(input, now);
}

function metricShape(status, value, unit, { numerator, denominator, reason } = {}) {
    if (!['available', 'limited', 'suppressed', 'unavailable'].includes(status) || !METRIC_UNITS.includes(unit)) {
        throw new AnalysisError('temporarily_unavailable');
    }
    if (value !== null && !isFiniteNumber(value)) throw new AnalysisError('temporarily_unavailable');
    if (numerator !== undefined && numerator !== null && (!isFiniteNumber(numerator) || numerator < 0)) throw new AnalysisError('temporarily_unavailable');
    if (denominator !== undefined && denominator !== null && (!isFiniteNumber(denominator) || denominator < 0)) throw new AnalysisError('temporarily_unavailable');
    if (reason !== undefined && (typeof reason !== 'string' || !reason || reason.length > 160)) throw new AnalysisError('temporarily_unavailable');
    const metric = { status, value, unit };
    if (numerator !== undefined) metric.numerator = numerator;
    if (denominator !== undefined) metric.denominator = denominator;
    if (reason !== undefined) metric.reason = reason;
    return Object.freeze(metric);
}

export const availableMetric = (value, unit, detail = {}) => metricShape('available', value, unit, detail);
export const limitedMetric = (value, unit, detail = {}) => metricShape('limited', value, unit, detail);
export const unavailableMetric = (unit, reason) => metricShape('unavailable', null, unit, { reason });
export const suppressedMetric = (unit, reason = 'privacy_suppressed') => metricShape('suppressed', null, unit, { reason });

export function ratioMetric(numerator, denominator, { status = 'available', reason } = {}) {
    if (!isFiniteNumber(numerator) || numerator < 0 || !isFiniteNumber(denominator) || denominator < 0) throw new AnalysisError('temporarily_unavailable');
    return metricShape(status, denominator === 0 ? null : numerator / denominator, 'ratio', {
        numerator, denominator, ...(denominator === 0 ? { reason: reason || 'zero_denominator' } : reason ? { reason } : {}),
    });
}

export function deltaMetric(current, previous) {
    if (!current || !previous || current.value === null || previous.value === null || current.status === 'unavailable' || previous.status === 'unavailable') {
        return unavailableMetric(current?.unit || previous?.unit || 'count', 'comparison_unavailable');
    }
    const status = current.status === 'suppressed' || previous.status === 'suppressed' ? 'suppressed'
        : current.status === 'limited' || previous.status === 'limited' ? 'limited' : 'available';
    if (status === 'suppressed') return suppressedMetric(current.unit);
    return metricShape(status, current.value - previous.value, current.unit);
}

export function relativeChangeMetric(current, previous) {
    if (!current || !previous || current.value === null || previous.value === null || previous.value === 0) {
        return unavailableMetric('ratio', previous?.value === 0 ? 'zero_baseline' : 'comparison_unavailable');
    }
    const status = current.status === 'limited' || previous.status === 'limited' ? 'limited' : 'available';
    return metricShape(status, (current.value - previous.value) / previous.value, 'ratio');
}

export function makeQuality({ status = 'complete', observationStart = null, observationEndExclusive = null, reasons = [] } = {}) {
    if (!['complete', 'limited', 'incomplete'].includes(status) || !Array.isArray(reasons) || reasons.some(reason => typeof reason !== 'string' || !reason || reason.length > 160)) {
        throw new AnalysisError('temporarily_unavailable');
    }
    if (observationStart !== null && !validDay(observationStart)) throw new AnalysisError('temporarily_unavailable');
    if (observationEndExclusive !== null && !validDay(observationEndExclusive)) throw new AnalysisError('temporarily_unavailable');
    return Object.freeze({
        status,
        observation_start: observationStart,
        observation_end_exclusive: observationEndExclusive,
        reasons: Object.freeze([...new Set(reasons)]),
    });
}

export function resultStatusFromMetrics(metrics) {
    const values = Object.values(metrics || {}).filter(value => value && typeof value === 'object' && Object.hasOwn(value, 'status'));
    if (!values.length) return 'unavailable';
    const available = values.filter(value => ['available', 'limited'].includes(value.status));
    if (!available.length) return 'unavailable';
    return available.length === values.length && available.every(value => value.status === 'available') ? 'ok' : 'partial';
}

const PRIVATE_OUTPUT_KEY = /(?:^|_)(?:user|person|email|phone|name|profile|auth|session|hash|timestamp|created_at|updated_at|raw)(?:_|$)/i;
const ALLOWED_IDENTIFIER_KEY = new Set(['program_ref', 'from_program_ref', 'to_program_ref', 'request_id', 'metric_id', 'name']);

export function assertPublicAnalysisOutput(value, path = '') {
    if (Array.isArray(value)) {
        for (const entry of value) assertPublicAnalysisOutput(entry, `${path}[]`);
        return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, nested] of Object.entries(value)) {
        if (PRIVATE_OUTPUT_KEY.test(key) && !ALLOWED_IDENTIFIER_KEY.has(key)) {
            throw new AnalysisError('temporarily_unavailable', { message: `private output key: ${path}.${key}` });
        }
        assertPublicAnalysisOutput(nested, `${path}.${key}`);
    }
}

export function makeAnalysisResult({ requestId, status, asOf, period = undefined, data = {}, quality = makeQuality(), warnings = [], sources = [], error = undefined, cache = {} } = {}) {
    if (typeof requestId !== 'string' || !requestId || requestId.length > 128 || !['ok', 'partial', 'unavailable', 'error'].includes(status)
        || typeof asOf !== 'string' || !Number.isFinite(Date.parse(asOf)) || !isPlainObject(data)
        || !Array.isArray(warnings) || !Array.isArray(sources)) throw new AnalysisError('temporarily_unavailable');
    if (period !== undefined) normalizedPeriod(period, { now: new Date(asOf), maxDays: 366 });
    if (warnings.some(warning => !isPlainObject(warning) || typeof warning.code !== 'string' || typeof warning.message !== 'string' || warning.message.length > 300)) throw new AnalysisError('temporarily_unavailable');
    if (sources.some(source => !isPlainObject(source) || typeof source.label !== 'string' || source.label.length > 160 || source.url != null && (typeof source.url !== 'string' || !/^https:\/\//.test(source.url)))) throw new AnalysisError('temporarily_unavailable');
    assertPublicAnalysisOutput(data);
    const output = {
        schema_version: SCHEMA_VERSION,
        definition_version: DEFINITION_VERSION,
        request_id: requestId,
        status,
        as_of: asOf,
        timezone: TIMEZONE,
        ...(period ? { period } : {}),
        basis: 'recorded_current_state',
        cache: {
            hit: cache.hit === true,
            generated_at: typeof cache.generated_at === 'string' ? cache.generated_at : asOf,
            expires_at: typeof cache.expires_at === 'string' ? cache.expires_at : null,
        },
        data,
        quality,
        warnings,
        sources,
    };
    if (error) output.error = { code: ERROR_CODES.includes(error.code) ? error.code : 'temporarily_unavailable', retryable: error.retryable === true };
    let responseBytes;
    try {
        responseBytes = new TextEncoder().encode(JSON.stringify(output)).byteLength;
    } catch {
        throw new AnalysisError('temporarily_unavailable');
    }
    if (responseBytes > MAX_PUBLIC_RESPONSE_BYTES) throw new AnalysisError('analysis_too_large');
    return Object.freeze(output);
}

export function makeErrorResult({ requestId, asOf, period, error }) {
    const resolved = error instanceof AnalysisError ? error : new AnalysisError('temporarily_unavailable', { retryable: true });
    return makeAnalysisResult({
        requestId,
        status: resolved.code === 'invalid_input' ? 'error' : 'unavailable',
        asOf,
        ...(period ? { period } : {}),
        data: {},
        quality: makeQuality({ status: 'incomplete', reasons: [resolved.code] }),
        warnings: [],
        sources: [],
        error: resolved,
    });
}
