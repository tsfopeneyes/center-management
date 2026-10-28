import { AnalysisError, isPlainObject, kstDay, shiftDay, validDay } from './contracts.mjs';

const IDENTIFIER = value => typeof value === 'string' || Number.isSafeInteger(value);
const personKey = value => `${typeof value}:${String(value)}`;

export const stablePersonKey = value => {
    if (!IDENTIFIER(value) || String(value) === '') throw new AnalysisError('source_incomplete');
    return personKey(value);
};

export function assertSnapshot(snapshot) {
    if (!isPlainObject(snapshot) || snapshot.complete !== true || !isPlainObject(snapshot.datasets)) {
        throw new AnalysisError('source_incomplete');
    }
    if (typeof snapshot.as_of !== 'string' || !Number.isFinite(Date.parse(snapshot.as_of))) {
        throw new AnalysisError('source_incomplete');
    }
    return snapshot;
}

export function dataset(snapshot, name, { required = true } = {}) {
    assertSnapshot(snapshot);
    const value = snapshot.datasets[name];
    if (value == null && !required) return null;
    if (!Array.isArray(value)) throw new AnalysisError('source_incomplete');
    return value;
}

export function immutableRows(rows, fields, identityFields) {
    if (!Array.isArray(rows)) throw new AnalysisError('source_incomplete');
    const seen = new Map();
    for (const input of rows) {
        if (!isPlainObject(input)) throw new AnalysisError('source_incomplete');
        const row = {};
        for (const field of fields) {
            if (!Object.hasOwn(input, field)) throw new AnalysisError('source_incomplete');
            row[field] = input[field];
        }
        const key = JSON.stringify(identityFields.map(field => row[field]));
        const serialized = JSON.stringify(row);
        if (seen.has(key) && seen.get(key) !== serialized) throw new AnalysisError('source_incomplete');
        seen.set(key, serialized);
    }
    return [...seen.values()].map(value => JSON.parse(value));
}

export function eligiblePeople(snapshot) {
    const users = immutableRows(dataset(snapshot, 'users'), ['id', 'user_group'], ['id']);
    const staff = immutableRows(dataset(snapshot, 'staff'), ['id', 'role'], ['id']);
    const people = new Map();
    for (const user of users) people.set(stablePersonKey(user.id), user);
    const staffPeople = new Set(staff
        .filter(member => ['admin', 'master'].includes(member.role))
        .map(member => stablePersonKey(member.id)));
    return Object.freeze({
        people,
        staffPeople,
        eligible(id) {
            const key = stablePersonKey(id);
            return people.has(key) && !staffPeople.has(key);
        },
        keyFor: stablePersonKey,
    });
}

const completeStatus = value => value === 'complete' || value === 'limited' || value === 'unknown';

function normaliseCoverageRow(value) {
    if (!isPlainObject(value) || !completeStatus(value.status || 'complete')) return null;
    const start = value.start ?? null;
    const endExclusive = value.end_exclusive ?? null;
    if (start !== null && !validDay(start) || endExclusive !== null && !validDay(endExclusive) || start && endExclusive && start >= endExclusive) return null;
    return Object.freeze({ status: value.status || 'complete', start, end_exclusive: endExclusive, reason: typeof value.reason === 'string' ? value.reason : null });
}

// Older fixtures use flat coverage keys.  The adapter can use the new form;
// this compatibility mapping is internal and never exposed as a user result.
export function coverageFor(snapshot, domain) {
    const coverage = snapshot.coverage;
    if (!coverage || !isPlainObject(coverage)) return Object.freeze({ status: 'unknown', start: null, end_exclusive: null, reason: 'coverage_unknown' });
    const nested = normaliseCoverageRow(coverage[domain]);
    if (nested) return nested;
    const legacy = {
        logs: ['logsStartDay', 'logsEndDay'],
        programs: ['programsStartDay', 'programsEndDay'],
        feedback: ['feedbackStartDay', 'feedbackEndDay'],
        rentals: ['rentalsStartDay', 'rentalsEndDay'],
        store: ['storeStartDay', 'storeEndDay'],
        surveys: ['surveysStartDay', 'surveysEndDay'],
    }[domain];
    if (!legacy) return Object.freeze({ status: 'unknown', start: null, end_exclusive: null, reason: 'coverage_unknown' });
    const [startKey, endKey] = legacy;
    if (validDay(coverage[startKey]) && validDay(coverage[endKey]) && coverage[startKey] < coverage[endKey]) {
        return Object.freeze({ status: 'complete', start: coverage[startKey], end_exclusive: coverage[endKey],
            reason: coverage.firstVisitHistoryComplete === false && domain === 'logs' ? 'first_visit_history_incomplete' : null });
    }
    return Object.freeze({ status: 'unknown', start: null, end_exclusive: null, reason: 'coverage_unknown' });
}

export function coverageIncludes(coverage, start, endExclusive) {
    return coverage?.status === 'complete' && validDay(start) && validDay(endExclusive)
        && coverage.start !== null && coverage.end_exclusive !== null
        && coverage.start <= start && coverage.end_exclusive >= endExclusive;
}

export function dateFromUnknown(value) {
    if (validDay(value)) return value;
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return kstDay(value);
    throw new AnalysisError('source_incomplete');
}

export const inPeriod = (day, period) => validDay(day) && day >= period.start && day < period.end_exclusive;
export const closedRange = (day, start, end) => validDay(day) && day >= start && day < end;

export function rangesForComparison(period, days) {
    return Object.freeze({
        before: Object.freeze({ start: shiftDay(period, -days), end_exclusive: period }),
        after: Object.freeze({ start: shiftDay(period, 1), end_exclusive: shiftDay(period, days + 1) }),
    });
}
