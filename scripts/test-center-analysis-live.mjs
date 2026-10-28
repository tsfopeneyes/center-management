import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCenterAnalysisService } from '../supabase/functions/_shared/centerAnalysis/service.mjs';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('usage: node scripts/test-center-analysis-live.mjs <supabase-db-query-output.json>');

const text = await readFile(fixturePath, 'utf8');
const jsonStart = text.indexOf('{');
if (jsonStart < 0) throw new Error('live query did not return JSON');
const response = JSON.parse(text.slice(jsonStart));
if (!Array.isArray(response.rows) || response.rows.length !== 1) throw new Error('live query must return exactly one sanitized snapshot');

const live = response.rows[0]?.live || response.rows[0];
const originalSnapshot = live?.snapshot;
const snapshot = originalSnapshot ? structuredClone(originalSnapshot) : null;
const site = process.argv[3] || 'ALL';
assert.ok(['ALL','HAIFN','ENOUGH_PLACE'].includes(site));
const period = process.argv[4] ? { start: process.argv[4], end_exclusive: process.argv[5] } : live?.period;
if (site !== 'ALL' && snapshot) {
    for (const name of ['locations','notices','rentalBookings','checkinSurveys']) {
        assert.ok(snapshot.datasets[name].every(row => Object.hasOwn(row,'site')));
        snapshot.datasets[name] = snapshot.datasets[name].filter(row => row.site === site);
    }
    const refs = new Set(snapshot.datasets.notices.map(row => String(row.id)));
    snapshot.datasets.satisfactionResponses = snapshot.datasets.satisfactionResponses.filter(row => refs.has(String(row.program_ref)));
}
if (!snapshot || !period) throw new Error('live query response is missing snapshot or period');

const requiredDatasets = [
    'users', 'staff', 'locations', 'logs',
    'notices', 'responses', 'sessions', 'sessionResponses', 'openAttendance', 'migratedProgramRefs',
    'satisfactionResponses',
    'rentalBookings', 'storeOrders', 'checkinSurveys',
];
for (const name of requiredDatasets) assert.ok(Array.isArray(snapshot.datasets?.[name]), `missing dataset: ${name}`);

// The live query must substitute every source identifier before it reaches the
// local test process.  This guard turns an accidental raw-id selection into a
// failed test rather than a locally persisted data export.
const safeIdentifiers = Object.freeze({
    person: /^person-\d+$/,
    location: /^location-\d+$/,
    log: /^log-\d+$/,
    program: /^program-\d+$/,
    session: /^session-\d+$/,
    satisfaction: /^satisfaction-\d+$/,
    rental: /^rental-\d+$/,
    store: /^store-\d+$/,
    survey: /^survey-\d+$/,
});
const mustMatch = (value, expression, label) => assert.match(String(value), expression, `${label} must be an ephemeral pseudonym`);
for (const row of snapshot.datasets.users) mustMatch(row.id, safeIdentifiers.person, 'user id');
for (const row of snapshot.datasets.staff) mustMatch(row.id, safeIdentifiers.person, 'staff id');
for (const row of snapshot.datasets.locations) mustMatch(row.id, safeIdentifiers.location, 'location id');
for (const row of snapshot.datasets.logs) {
    mustMatch(row.id, safeIdentifiers.log, 'log id');
    mustMatch(row.user_id, safeIdentifiers.person, 'log user id');
    if (row.location_id !== null) mustMatch(row.location_id, safeIdentifiers.location, 'log location id');
}
for (const row of snapshot.datasets.notices) mustMatch(row.id, safeIdentifiers.program, 'program id');
for (const row of snapshot.datasets.responses) {
    mustMatch(row.notice_id, safeIdentifiers.program, 'response program id');
    mustMatch(row.user_id, safeIdentifiers.person, 'response user id');
}
for (const row of snapshot.datasets.sessions) {
    mustMatch(row.id, safeIdentifiers.session, 'session id');
    mustMatch(row.notice_id, safeIdentifiers.program, 'session program id');
}
for (const row of snapshot.datasets.sessionResponses) {
    mustMatch(row.session_id, safeIdentifiers.session, 'session response id');
    mustMatch(row.user_id, safeIdentifiers.person, 'session response user id');
}
for (const row of snapshot.datasets.openAttendance) {
    mustMatch(row.notice_id, safeIdentifiers.program, 'attendance program id');
    mustMatch(row.user_id, safeIdentifiers.person, 'attendance user id');
}
for (const row of snapshot.datasets.migratedProgramRefs) mustMatch(row.notice_id, safeIdentifiers.program, 'migrated program id');
for (const row of snapshot.datasets.satisfactionResponses) {
    mustMatch(row.id, safeIdentifiers.satisfaction, 'satisfaction id');
    mustMatch(row.program_ref, safeIdentifiers.program, 'satisfaction program id');
    assert.ok(Number.isSafeInteger(row.value) && row.value >= 1 && row.value <= 5, 'satisfaction value must be numeric 1..5');
}
for (const row of snapshot.datasets.rentalBookings) mustMatch(row.id, safeIdentifiers.rental, 'rental id');
for (const row of snapshot.datasets.storeOrders) mustMatch(row.id, safeIdentifiers.store, 'store id');
for (const row of snapshot.datasets.checkinSurveys) mustMatch(row.id, safeIdentifiers.survey, 'survey id');

const kstDay = value => new Date(Date.parse(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const inPeriod = value => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : kstDay(value);
    return day >= period.start && day < period.end_exclusive;
};
const eligibleContext = () => {
    const people = new Set(snapshot.datasets.users.map(row => String(row.id)));
    const staff = new Set(snapshot.datasets.staff
        .filter(row => ['admin', 'master'].includes(row.role))
        .map(row => String(row.id)));
    return id => people.has(String(id)) && !staff.has(String(id));
};

function visitOracle() {
    const eligible = eligibleContext();
    const locations = new Set(snapshot.datasets.locations.map(row => String(row.id)));
    const eventOrder = { CHECKIN: 0, MOVE: 1, CHECKOUT: 2 };
    const asOf = Date.parse(snapshot.as_of);
    const groups = new Map();
    for (const row of snapshot.datasets.logs) {
        const time = Date.parse(row.created_at);
        if (!Object.hasOwn(eventOrder, row.type) || !Number.isFinite(time) || time > asOf || !eligible(row.user_id)) continue;
        const day = kstDay(row.created_at);
        const key = `${row.user_id}\u0000${day}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ ...row, day, time });
    }
    const sessions = [];
    for (const rows of groups.values()) {
        rows.sort((left, right) => left.time - right.time || eventOrder[left.type] - eventOrder[right.type] || String(left.id).localeCompare(String(right.id)));
        let active = null;
        const addInterval = (end) => {
            if (locations.has(String(active.location))) active.recorded_minutes += Math.max(0, Math.floor((end - active.started_at) / 60_000));
        };
        const finish = (checkout = null) => {
            if (!active) return;
            if (checkout) {
                addInterval(checkout.time);
                active.checkout_at = checkout.time;
            }
            if (active.touched) sessions.push({
                person: active.person,
                day: active.day,
                recorded_minutes: active.recorded_minutes,
                complete_minutes: active.checkout_at !== null && active.recorded_minutes > 0 ? active.recorded_minutes : 0,
                has_checkout: active.checkout_at !== null,
                measured: active.checkout_at !== null && active.recorded_minutes > 0,
            });
            active = null;
        };
        for (const row of rows) {
            if (row.type === 'CHECKIN') {
                if (active) continue;
                active = {
                    person: String(row.user_id), day: row.day, location: String(row.location_id), started_at: row.time,
                    recorded_minutes: 0, touched: locations.has(String(row.location_id)), checkout_at: null,
                };
            } else if (!active) {
                continue;
            } else if (row.type === 'MOVE') {
                addInterval(row.time);
                active.location = String(row.location_id);
                active.started_at = row.time;
                if (locations.has(active.location)) active.touched = true;
            } else {
                finish(row);
            }
        }
        finish();
    }
    const scoped = sessions.filter(row => inPeriod(row.day));
    const measured = scoped.filter(row => row.measured).map(row => row.complete_minutes).sort((left, right) => left - right);
    const median = !measured.length ? null : measured.length % 2
        ? measured[(measured.length - 1) / 2]
        : (measured[measured.length / 2 - 1] + measured[measured.length / 2]) / 2;
    return {
        visit_sessions: scoped.length,
        unique_visitors: new Set(scoped.map(row => row.person)).size,
        visitor_days: new Set(scoped.map(row => `${row.person}\u0000${row.day}`)).size,
        recorded_minutes: scoped.reduce((sum, row) => sum + row.recorded_minutes, 0),
        complete_duration_mean: measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : null,
        complete_duration_median: median,
        missing_checkout_sessions: scoped.filter(row => !row.has_checkout).length,
    };
}

function programOracle() {
    const eligible = eligibleContext();
    const asOfDay = kstDay(snapshot.as_of);
    const notices = new Map(snapshot.datasets.notices
        .filter(row => row.category === 'PROGRAM' && row.program_status !== 'CANCELLED')
        .map(row => [String(row.id), row]));
    const migrated = new Set(snapshot.datasets.migratedProgramRefs.map(row => String(row.notice_id)));
    const sessionResponses = new Map();
    const noticeResponses = new Map();
    const attendance = new Map();
    for (const row of snapshot.datasets.sessionResponses) {
        const key = String(row.session_id);
        if (!sessionResponses.has(key)) sessionResponses.set(key, []);
        sessionResponses.get(key).push(row);
    }
    for (const row of snapshot.datasets.responses) {
        const key = String(row.notice_id);
        if (!noticeResponses.has(key)) noticeResponses.set(key, []);
        noticeResponses.get(key).push(row);
    }
    for (const row of snapshot.datasets.openAttendance) {
        const key = String(row.notice_id);
        if (!attendance.has(key)) attendance.set(key, []);
        attendance.get(key).push(row);
    }
    const occurrences = [];
    const addOccurrence = (programRef, dateValue, rows, open = false) => {
        const day = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : Number.isFinite(Date.parse(dateValue)) ? kstDay(dateValue) : null;
        if (!day) return;
        const applications = [];
        const attendancePeople = new Set();
        for (const row of rows) {
            if (!eligible(row.user_id) || row.is_staff === true) continue;
            if (!open && ['JOIN', 'WAITLIST', 'CANCELLED'].includes(row.status)) applications.push({ person: String(row.user_id), status: row.status });
            if (day <= asOfDay && (open || row.status === 'JOIN' && row.is_attended === true)) attendancePeople.add(String(row.user_id));
        }
        occurrences.push({ program_ref: String(programRef), day, applications, attendance_people: attendancePeople });
    };
    for (const session of snapshot.datasets.sessions) {
        const ref = String(session.notice_id);
        if (!notices.has(ref) || session.voided_at || ['VOIDED', 'CANCELLED'].includes(session.status)) continue;
        addOccurrence(ref, session.session_date, sessionResponses.get(String(session.id)) || []);
    }
    for (const [ref, notice] of notices) {
        if (migrated.has(ref)) continue;
        if (notice.is_recruiting === false) {
            const byDay = new Map();
            for (const row of attendance.get(ref) || []) {
                const day = /^\d{4}-\d{2}-\d{2}$/.test(row.attendance_date) ? row.attendance_date : kstDay(row.attendance_date);
                if (!byDay.has(day)) byDay.set(day, []);
                byDay.get(day).push(row);
            }
            for (const [day, rows] of byDay) addOccurrence(ref, day, rows, true);
        } else {
            addOccurrence(ref, notice.program_date, noticeResponses.get(ref) || []);
        }
    }
    const scoped = occurrences.filter(row => inPeriod(row.day));
    const applications = scoped.flatMap(row => row.applications);
    const attended = scoped.flatMap(row => [...row.attendance_people]);
    const satisfaction = snapshot.datasets.satisfactionResponses
        .filter(row => inPeriod(row.submitted_at))
        .map(row => row.value);
    return {
        applications: applications.length,
        joined_applications: applications.filter(row => row.status === 'JOIN').length,
        waitlisted_applications: applications.filter(row => row.status === 'WAITLIST').length,
        cancelled_applications: applications.filter(row => row.status === 'CANCELLED').length,
        recorded_attendance: attended.length,
        satisfaction_mean: satisfaction.length ? satisfaction.reduce((sum, value) => sum + value, 0) / satisfaction.length : null,
        satisfaction_response_count: satisfaction.length,
    };
}

function operationsOracle() {
    return {
        rental_bookings: snapshot.datasets.rentalBookings.filter(row => inPeriod(row.booking_date)).length,
        store_orders: snapshot.datasets.storeOrders.filter(row => inPeriod(row.created_at)).length,
        survey_submissions: snapshot.datasets.checkinSurveys.filter(row => inPeriod(row.created_at)).length,
    };
}

const expected = { ...visitOracle(), ...programOracle(), ...operationsOracle() };
if (site !== 'ALL') delete expected.store_orders;
const repository = { async readSnapshot() { return originalSnapshot; } };
const service = createCenterAnalysisService({
    repository,
    now: () => new Date(snapshot.as_of),
    requestId: () => 'live-readonly-validation',
});
const result = await service.run({
    operation: 'get_operation_summary',
    input: { period, site, domains: ['visits', 'duration', 'programs', 'feedback', 'rentals', ...(site === 'ALL' ? ['store'] : []), 'surveys'] },
    actor: { active: true, capabilities: ['analytics.read'] },
});

assert.equal(result.status, 'ok');
const metrics = result.data.periods?.[0]?.metrics;
assert.ok(metrics, 'operation summary must contain the requested period');
for (const [metricId, value] of Object.entries(expected)) {
    assert.equal(metrics[metricId]?.status, 'available', `${metricId} must be available`);
    assert.equal(metrics[metricId]?.value, value, `${metricId} differs from the independently computed live-data oracle`);
}

const engagement = await service.run({
    operation: 'analyze_program_engagement',
    input: { period, site, breakdown: 'none', measures: ['applications', 'recorded_attendance', 'satisfaction'] },
    actor: { active: true, capabilities: ['analytics.read'] },
});
assert.equal(engagement.status, 'ok');
const engagementTotals = engagement.data.periods?.[0]?.totals;
assert.equal(engagementTotals?.applications?.value, expected.applications);
assert.equal(engagementTotals?.recorded_attendance?.value, expected.recorded_attendance);
assert.equal(engagementTotals?.satisfaction_mean?.value, expected.satisfaction_mean);
assert.equal(engagementTotals?.satisfaction_response_count?.value, expected.satisfaction_response_count);

console.log(`CENTER LIVE ANALYSIS PASS site=${site} period=${period.start}/${period.end_exclusive}`);
console.log(`CENTER LIVE ANALYSIS METRICS visits=${expected.visit_sessions} visitors=${expected.unique_visitors} programs=${expected.applications} attendance=${expected.recorded_attendance} satisfactionResponses=${expected.satisfaction_response_count} rentals=${expected.rental_bookings} store=${expected.store_orders} surveys=${expected.survey_submissions}`);
console.log('CENTER LIVE PROGRAM ENGAGEMENT PASS aggregate request matched the independent live-data oracle');
