import { AnalysisError, kstDay, validDay } from './contracts.mjs';
import { dataset, eligiblePeople, immutableRows, inPeriod, stablePersonKey } from './normalize.mjs';

const APPLICATION_STATUSES = new Set(['JOIN', 'WAITLIST', 'CANCELLED']);
const cancelledSession = row => Boolean(row.voided_at) || ['VOIDED', 'CANCELLED'].includes(row.status);
const programDate = value => {
    if (validDay(value)) return value;
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return kstDay(value);
    return null;
};

function coreData(snapshot) {
    const notices = immutableRows(dataset(snapshot, 'notices'), ['id', 'category', 'program_date', 'created_at', 'program_status', 'is_recruiting'], ['id']);
    const responses = immutableRows(dataset(snapshot, 'responses'), ['notice_id', 'user_id', 'status', 'is_attended', 'is_staff'], ['notice_id', 'user_id']);
    const sessions = immutableRows(dataset(snapshot, 'sessions'), ['id', 'notice_id', 'session_date', 'status', 'voided_at'], ['id']);
    const sessionResponses = immutableRows(dataset(snapshot, 'sessionResponses'), ['session_id', 'user_id', 'status', 'is_attended'], ['session_id', 'user_id']);
    const openAttendance = immutableRows(dataset(snapshot, 'openAttendance'), ['notice_id', 'user_id', 'attendance_date'], ['notice_id', 'user_id', 'attendance_date']);
    const migratedProgramRefs = dataset(snapshot, 'migratedProgramRefs', { required: false });
    const migrated = migratedProgramRefs === null ? null
        : immutableRows(migratedProgramRefs, ['notice_id'], ['notice_id']);
    return { notices, responses, sessions, sessionResponses, openAttendance, migrated };
}

function addOccurrence(target, { program_ref, occurrence_ref, date, rows, open = false, eligible, asOfDay }) {
    if (!validDay(date)) {
        target.quality.missing_program_dates += 1;
        return;
    }
    const applicationPeople = new Set();
    const attendancePeople = new Set();
    const applications = [];
    for (const row of rows) {
        if (!eligible(row.user_id) || row.is_staff === true) continue;
        const person = stablePersonKey(row.user_id);
        if (!open && APPLICATION_STATUSES.has(row.status)) {
            applicationPeople.add(person);
            applications.push(Object.freeze({ person, status: row.status }));
        }
        if (date <= asOfDay && (open || row.status === 'JOIN' && row.is_attended === true)) attendancePeople.add(person);
    }
    target.occurrences.push(Object.freeze({
        program_ref: String(program_ref),
        occurrence_ref: String(occurrence_ref),
        date,
        applications: Object.freeze(applications),
        application_people: applicationPeople,
        attendance_people: attendancePeople,
    }));
}

function numericSatisfaction(snapshot) {
    const rows = dataset(snapshot, 'satisfactionResponses', { required: false });
    if (rows === null) return null;
    const seen = new Map();
    for (const raw of rows) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.id !== 'string' || typeof raw.program_ref !== 'string'
            || !Number.isSafeInteger(raw.value) || raw.value < 1 || raw.value > 5 || typeof raw.submitted_at !== 'string' || !Number.isFinite(Date.parse(raw.submitted_at))) {
            throw new AnalysisError('source_incomplete');
        }
        const row = { id: raw.id, program_ref: raw.program_ref, value: raw.value, submitted_at: raw.submitted_at };
        const serialized = JSON.stringify(row);
        if (seen.has(row.id) && seen.get(row.id) !== serialized) throw new AnalysisError('source_incomplete');
        seen.set(row.id, serialized);
    }
    return Object.freeze([...seen.values()].map(value => JSON.parse(value)));
}

// Returns only internal person keys.  It never copies notice title/body or
// feedback text, so a later adapter cannot accidentally expose those fields.
export function buildProgramFacts(snapshot) {
    const asOfDay = kstDay(snapshot?.as_of);
    const { eligible } = eligiblePeople(snapshot);
    const { notices, responses, sessions, sessionResponses, openAttendance, migrated: declaredMigrated } = coreData(snapshot);
    const programs = new Map(notices
        .filter(notice => notice.category === 'PROGRAM' && notice.program_status !== 'CANCELLED')
        .map(notice => [String(notice.id), notice]));
    // The database adapter supplies all migrated notice ids even when its
    // date-bounded session query has no rows.  Without that declaration, an
    // old whole-notice response could be counted alongside a migrated session.
    const migrated = new Set((declaredMigrated || sessions).map(row => String(row.notice_id)));
    const target = { occurrences: [], quality: { missing_program_dates: 0 } };
    const responsesBySession = new Map();
    for (const response of sessionResponses) {
        const key = String(response.session_id);
        if (!responsesBySession.has(key)) responsesBySession.set(key, []);
        responsesBySession.get(key).push(response);
    }
    for (const session of sessions) {
        const ref = String(session.notice_id);
        if (!programs.has(ref) || cancelledSession(session)) continue;
        addOccurrence(target, { program_ref: ref, occurrence_ref: session.id, date: programDate(session.session_date),
            rows: responsesBySession.get(String(session.id)) || [], eligible, asOfDay });
    }
    const responsesByNotice = new Map();
    for (const response of responses) {
        const key = String(response.notice_id);
        if (!responsesByNotice.has(key)) responsesByNotice.set(key, []);
        responsesByNotice.get(key).push(response);
    }
    const attendanceByNotice = new Map();
    for (const row of openAttendance) {
        const key = String(row.notice_id);
        if (!attendanceByNotice.has(key)) attendanceByNotice.set(key, []);
        attendanceByNotice.get(key).push(row);
    }
    for (const [ref, notice] of programs) {
        if (migrated.has(ref)) continue;
        if (notice.is_recruiting === false) {
            const grouped = new Map();
            for (const row of attendanceByNotice.get(ref) || []) {
                const date = programDate(row.attendance_date);
                if (!date) { target.quality.missing_program_dates += 1; continue; }
                if (!grouped.has(date)) grouped.set(date, []);
                grouped.get(date).push(row);
            }
            for (const [date, rows] of grouped) addOccurrence(target, { program_ref: ref, occurrence_ref: `open:${date}`, date, rows, open: true, eligible, asOfDay });
        } else {
            // Notice creation is never substituted for a missing program date.
            addOccurrence(target, { program_ref: ref, occurrence_ref: 'whole', date: programDate(notice.program_date),
                rows: responsesByNotice.get(ref) || [], eligible, asOfDay });
        }
    }
    const attendance = [];
    for (const occurrence of target.occurrences) {
        for (const person of occurrence.attendance_people) attendance.push(Object.freeze({ person, program_ref: occurrence.program_ref, date: occurrence.date }));
    }
    return Object.freeze({
        occurrences: Object.freeze(target.occurrences),
        attendance: Object.freeze(attendance),
        satisfaction: numericSatisfaction(snapshot),
        quality: Object.freeze(target.quality),
    });
}

const selected = (programRef, refs) => !refs || refs.includes(programRef);
const countStatuses = rows => Object.freeze({
    applications: rows.length,
    joined_applications: rows.filter(row => row.status === 'JOIN').length,
    waitlisted_applications: rows.filter(row => row.status === 'WAITLIST').length,
    cancelled_applications: rows.filter(row => row.status === 'CANCELLED').length,
});

export function summarizePrograms(facts, period, { programRefs = null } = {}) {
    if (!facts?.occurrences || !validDay(period?.start) || !validDay(period?.end_exclusive)) throw new AnalysisError('source_incomplete');
    const occurrences = facts.occurrences.filter(occurrence => inPeriod(occurrence.date, period) && selected(occurrence.program_ref, programRefs));
    const byProgram = new Map();
    const applications = [];
    const attendance = [];
    for (const occurrence of occurrences) {
        if (!byProgram.has(occurrence.program_ref)) byProgram.set(occurrence.program_ref, { applications: [], attendance: [] });
        const destination = byProgram.get(occurrence.program_ref);
        destination.applications.push(...occurrence.applications);
        const people = [...occurrence.attendance_people];
        destination.attendance.push(...people);
        applications.push(...occurrence.applications);
        attendance.push(...people.map(person => ({ person, program_ref: occurrence.program_ref, date: occurrence.date })));
    }
    const satisfaction = facts.satisfaction === null ? null : facts.satisfaction
        .filter(row => inPeriod(kstDay(row.submitted_at), period) && selected(row.program_ref, programRefs));
    const satisfactionByProgram = new Map();
    for (const row of satisfaction || []) {
        if (!satisfactionByProgram.has(row.program_ref)) satisfactionByProgram.set(row.program_ref, []);
        satisfactionByProgram.get(row.program_ref).push(row.value);
    }
    const byProgramSummary = [...byProgram.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([program_ref, rows]) => {
        const values = satisfactionByProgram.get(program_ref) || [];
        return Object.freeze({
            program_ref,
            ...countStatuses(rows.applications),
            recorded_attendance: rows.attendance.length,
            satisfaction_mean: facts.satisfaction === null ? null : values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
            satisfaction_response_count: facts.satisfaction === null ? null : values.length,
            subjects: new Set([...rows.applications.map(row => row.person), ...rows.attendance]).size,
        });
    });
    const peoplePrograms = new Map();
    for (const row of attendance) {
        if (!peoplePrograms.has(row.person)) peoplePrograms.set(row.person, new Set());
        peoplePrograms.get(row.person).add(row.program_ref);
    }
    const distribution = { '1': 0, '2': 0, '3_plus': 0 };
    for (const programs of peoplePrograms.values()) distribution[programs.size === 1 ? '1' : programs.size === 2 ? '2' : '3_plus'] += 1;
    const total = Object.freeze({
        ...countStatuses(applications),
        recorded_attendance: attendance.length,
        satisfaction_mean: satisfaction?.length ? satisfaction.reduce((sum, row) => sum + row.value, 0) / satisfaction.length : null,
        satisfaction_response_count: satisfaction?.length ?? null,
        subjects: new Set(attendance.map(row => row.person)).size,
    });
    return Object.freeze({
        total,
        programs: Object.freeze(byProgramSummary),
        attendance: Object.freeze(attendance),
        participation_distribution: Object.freeze(distribution),
        quality: facts.quality,
    });
}
