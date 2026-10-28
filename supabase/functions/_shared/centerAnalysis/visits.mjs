import { AnalysisError, kstDay, validDay } from './contracts.mjs';
import { dataset, eligiblePeople, immutableRows, inPeriod, stablePersonKey } from './normalize.mjs';

const EVENT_ORDER = Object.freeze({ CHECKIN: 0, MOVE: 1, CHECKOUT: 2 });
const durationMinutes = (start, end) => Math.max(0, Math.floor((end - start) / 60_000));

function visitLogs(snapshot, asOf) {
    const rows = immutableRows(dataset(snapshot, 'logs'), ['id', 'user_id', 'type', 'location_id', 'created_at'], ['id']);
    const { eligible } = eligiblePeople(snapshot);
    const cutoff = Date.parse(asOf);
    const valid = [];
    for (const row of rows) {
        if (!Object.hasOwn(EVENT_ORDER, row.type) || !Number.isFinite(Date.parse(row.created_at)) || Date.parse(row.created_at) > cutoff) continue;
        if (!eligible(row.user_id)) continue;
        valid.push({ ...row, person: stablePersonKey(row.user_id), day: kstDay(row.created_at), time: Date.parse(row.created_at) });
    }
    return valid.sort((left, right) => left.time - right.time || EVENT_ORDER[left.type] - EVENT_ORDER[right.type] || String(left.id).localeCompare(String(right.id)));
}

function locationIds(snapshot) {
    const rows = immutableRows(dataset(snapshot, 'locations'), ['id'], ['id']);
    return new Set(rows.map(row => String(row.id)));
}

const grouped = rows => {
    const groups = new Map();
    for (const row of rows) {
        const key = `${row.person}\u0000${row.day}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    return groups;
};

function buildPersonSession(rows, validLocations, quality) {
    const sessions = [];
    let active = null;
    const finish = checkout => {
        if (!active) return;
        if (checkout) {
            active.addInterval(checkout.time);
            active.checkoutAt = checkout.time;
        }
        if (active.touched) sessions.push(Object.freeze({
            person: active.person,
            day: active.day,
            recorded_minutes: active.recordedMinutes,
            complete_minutes: active.checkoutAt != null && active.recordedMinutes > 0 ? active.recordedMinutes : 0,
            has_checkout: active.checkoutAt != null,
            measured: active.checkoutAt != null && active.recordedMinutes > 0,
        }));
        active = null;
    };
    for (const row of rows) {
        if (row.type === 'CHECKIN') {
            if (active) {
                quality.overlapping_checkins += 1;
                continue;
            }
            const initialLocation = String(row.location_id);
            active = {
                person: row.person,
                day: row.day,
                location: initialLocation,
                startedAt: row.time,
                recordedMinutes: 0,
                touched: validLocations.has(initialLocation),
                checkoutAt: null,
                addInterval(end) {
                    if (validLocations.has(this.location)) {
                        this.touched = true;
                        this.recordedMinutes += durationMinutes(this.startedAt, end);
                    }
                },
            };
            continue;
        }
        if (!active) {
            if (row.type === 'CHECKOUT') quality.orphan_checkouts += 1;
            else quality.orphan_moves += 1;
            continue;
        }
        if (row.type === 'MOVE') {
            active.addInterval(row.time);
            active.location = String(row.location_id);
            active.startedAt = row.time;
            if (validLocations.has(active.location)) active.touched = true;
            continue;
        }
        finish(row);
    }
    finish(null);
    return sessions;
}

// All per-person keys in this return value are server-internal.  Callers must
// pass the result through the operation/disclosure layers before returning data.
export function buildVisitFacts(snapshot) {
    const asOf = snapshot?.as_of;
    if (typeof asOf !== 'string' || !Number.isFinite(Date.parse(asOf))) throw new AnalysisError('source_incomplete');
    const locations = locationIds(snapshot);
    const quality = { orphan_checkouts: 0, orphan_moves: 0, overlapping_checkins: 0 };
    const sessions = [];
    for (const rows of grouped(visitLogs(snapshot, asOf)).values()) sessions.push(...buildPersonSession(rows, locations, quality));
    const byPerson = new Map();
    for (const session of sessions) {
        if (!byPerson.has(session.person)) byPerson.set(session.person, []);
        byPerson.get(session.person).push(session);
    }
    return Object.freeze({
        as_of: asOf,
        sessions: Object.freeze(sessions),
        by_person: byPerson,
        quality: Object.freeze(quality),
    });
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeVisits(facts, period) {
    if (!facts?.sessions || !validDay(period?.start) || !validDay(period?.end_exclusive)) throw new AnalysisError('source_incomplete');
    const scoped = facts.sessions.filter(session => inPeriod(session.day, period));
    const visitors = new Set(scoped.map(session => session.person));
    const visitorDays = new Set(scoped.map(session => `${session.person}\u0000${session.day}`));
    const measured = scoped.filter(session => session.measured).map(session => session.complete_minutes);
    const perPersonMinutes = new Map();
    for (const session of scoped) {
        if (session.complete_minutes > 0) perPersonMinutes.set(session.person, (perPersonMinutes.get(session.person) || 0) + session.complete_minutes);
    }
    const completeMinutes = measured.reduce((total, value) => total + value, 0);
    return Object.freeze({
        visit_sessions: scoped.length,
        unique_visitors: visitors.size,
        visitor_days: visitorDays.size,
        recorded_minutes: scoped.reduce((total, session) => total + session.recorded_minutes, 0),
        complete_duration_mean: measured.length ? completeMinutes / measured.length : null,
        complete_duration_median: median(measured),
        complete_duration_sessions: measured.length,
        missing_checkout_sessions: scoped.filter(session => !session.has_checkout).length,
        risk: Object.freeze({
            subjects: visitors.size,
            largest_duration_share: completeMinutes ? Math.max(0, ...perPersonMinutes.values()) / completeMinutes : 0,
        }),
        quality: facts.quality,
    });
}

export function personVisitSummary(facts, person, period) {
    const rows = facts?.by_person?.get(person) || [];
    const scoped = rows.filter(session => inPeriod(session.day, period));
    const measured = scoped.filter(session => session.measured).map(session => session.complete_minutes);
    return Object.freeze({
        visitor_days: new Set(scoped.map(session => session.day)).size,
        visit_sessions: scoped.length,
        measured_duration: measured.reduce((total, value) => total + value, 0),
        measured_sessions: measured.length,
    });
}
