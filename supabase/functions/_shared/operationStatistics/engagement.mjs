import { calculateVisitStatistics } from './aggregate.mjs';
import { StatisticsError, dayKst, validDay, periodWindow } from './policy.mjs';
const shift = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const inRange = (day, start, end) => day >= start && day < end;
const ratio = (n, d) => d ? n / d : null;
function deduplicate(rows, keys) {
    const result = new Map();
    for (const row of rows) {
        const key = JSON.stringify(keys.map(k => row[k]));
        if (result.has(key) && JSON.stringify(result.get(key)) !== JSON.stringify(row)) throw new StatisticsError('source_incomplete');
        result.set(key, row);
    }
    return [...result.values()];
}

// SERVER INTERNAL. Person joins exist only in local sets/maps; outputs contain
// aggregates. No per-person aliases, persistent hashes or person rows exported.
// This is calculation feasibility, not authorization to publish its results.
export function analyzeEngagement(source, { window, asOf, followupDays = 7, comparisonDays = 7, attendanceBasis = 'recorded' } = {}) {
    if (source?.complete !== true || !window || ![7, 14, 30].includes(followupDays) || ![7, 14, 28, 30].includes(comparisonDays)) throw new StatisticsError('source_incomplete');
    const at = new Date(asOf), today = dayKst(at.toISOString()), d = source.datasets;
    if (!['recorded', 'confirmed'].includes(attendanceBasis)) throw new StatisticsError('source_incomplete');
    const recorded = attendanceBasis === 'recorded';
    if (!d || ['users', 'staff', 'logs', 'locations', 'notices', 'responses', 'sessions', 'sessionResponses', 'openAttendance'].some(key => !Array.isArray(d[key]))) throw new StatisticsError('source_incomplete');
    const users = new Map(d.users.map(row => [row.id, row]));
    const staff = new Set(d.staff.filter(row => ['admin', 'master'].includes(row.role)).map(row => row.id));
    const eligible = id => users.has(id) && !staff.has(id);
    const visits = [], personDays = new Map();
    for (const log of deduplicate(d.logs, ['id'])) {
        if (!eligible(log.user_id) || Date.parse(log.created_at) > at.getTime()) continue;
        const date = dayKst(log.created_at), key = JSON.stringify([log.user_id, date]);
        if (!personDays.has(key)) personDays.set(key, []); personDays.get(key).push(log);
    }
    for (const logs of personDays.values()) {
        const person = logs[0].user_id, date = dayKst(logs[0].created_at);
        const result = calculateVisitStatistics({ logs, users: [users.get(person)], staff: [], locations: d.locations, window: periodWindow({ kind: 'day', date }), now: at });
        if (result.visits.visit_sessions) visits.push({ person, date, visits: result.visits.visit_sessions,
            complete_minutes: result.duration.complete_minutes, measured_sessions: result.duration.valid_sessions, missing_checkout: result.duration.missing_checkout_sessions });
    }
    const programMap = new Map(d.notices.filter(row => row.category === 'PROGRAM' && row.program_status !== 'CANCELLED').map(row => [String(row.id), row]));
    const migrated = new Set(d.sessions.map(row => String(row.notice_id)));
    const applications = [], attendance = [], occurrenceRates = []; let missingProgramDate = 0, unconfirmedAttendance = 0, unknownOrigins = 0;
    const confirmedComplete = recorded || source.capabilities?.confirmedAttendance === true;
    const originsComplete = source.capabilities?.applicationOrigins === true;
    const add = (program, date, rows, open = false) => {
        if (!validDay(date)) { missingProgramDate++; return; }
        let joined = 0, applicantAttended = 0, attended = 0;
        for (const row of rows) {
            if (!eligible(row.user_id) || row.is_staff === true) continue;
            if (!open && ['JOIN', 'WAITLIST'].includes(row.status) && !['PREREGISTERED', 'WALK_IN'].includes(row.application_origin)) unknownOrigins++;
            if (!open && inRange(date, window.startDay, window.endDay) && ['JOIN', 'WAITLIST'].includes(row.status) && row.application_origin !== 'WALK_IN') applications.push({ person: row.user_id, program, date });
            if (!open && row.status === 'JOIN' && row.application_origin === 'PREREGISTERED') joined++;
            if (!recorded && (open || row.status === 'JOIN') && row.attendance_confirmed !== true) unconfirmedAttendance++;
            if (date <= today && (recorded || row.attendance_confirmed === true) && (open || row.status === 'JOIN' && row.is_attended === true)) {
                attendance.push({ person: row.user_id, program, date }); attended++;
                if (!open && row.status === 'JOIN' && row.application_origin === 'PREREGISTERED') applicantAttended++;
            }
        }
        if (inRange(date, window.startDay, window.endDay)) occurrenceRates.push({ program_ref: program, date, valid_preregistered: joined, attended,
            applicant_attended: applicantAttended, applicant_attendance_rate: ratio(applicantAttended, joined) });
    };
    for (const session of deduplicate(d.sessions, ['id'])) {
        const ref = String(session.notice_id);
        if (!programMap.has(ref) || session.voided_at || ['CANCELLED', 'VOIDED'].includes(session.status)) continue;
        add(ref, session.session_date, deduplicate(d.sessionResponses.filter(row => String(row.session_id) === String(session.id)), ['session_id', 'user_id']));
    }
    for (const [ref, notice] of programMap) {
        if (migrated.has(ref)) continue;
        if (notice.is_recruiting === false) {
            for (const row of deduplicate(d.openAttendance.filter(row => String(row.notice_id) === ref), ['notice_id', 'attendance_date', 'user_id'])) add(ref, row.attendance_date, [row], true);
        } else {
            // Creation date is NOT evidence of a participation date.
            const date = notice.program_date ? (validDay(notice.program_date) ? notice.program_date : dayKst(notice.program_date)) : null;
            add(ref, date, deduplicate(d.responses.filter(row => String(row.notice_id) === ref), ['notice_id', 'user_id']));
        }
    }
    const distribution = events => {
        const people = new Map();
        for (const event of events) { if (!people.has(event.person)) people.set(event.person, new Set()); people.get(event.person).add(event.program); }
        const counts = { one_program: 0, two_programs: 0, three_or_more_programs: 0 };
        for (const programs of people.values()) counts[programs.size === 1 ? 'one_program' : programs.size === 2 ? 'two_programs' : 'three_or_more_programs']++;
        return { ...counts, people: people.size, repeat_people: counts.two_programs + counts.three_or_more_programs,
            repeat_rate: ratio(counts.two_programs + counts.three_or_more_programs, people.size) };
    };
    const firstVisits = new Map();
    for (const visit of visits) if (inRange(visit.date, window.startDay, window.endDay) && (!firstVisits.has(visit.person) || firstVisits.get(visit.person) > visit.date)) firstVisits.set(visit.person, visit.date);
    let matured = 0, censored = 0, revisited = 0;
    for (const [person, date] of firstVisits) {
        if (!inRange(date, window.startDay, window.endDay)) continue;
        const end = shift(date, followupDays + 1);
        if (end > today) { censored++; continue; }
        matured++;
        if (visits.some(v => v.person === person && v.date > date && v.date < end)) revisited++;
    }
    const coverage = source.coverage || {};
    const observationComplete = validDay(coverage.logsStartDay) && validDay(coverage.logsEndDay) && coverage.logsStartDay <= window.startDay && coverage.logsEndDay >= today;
    const revisits = observationComplete ? { status: 'calculated', cohort: 'first_observed_visit_in_period', followup_days: followupDays, matured_people: matured, censored_people: censored, revisited_people: revisited, revisit_rate: ratio(revisited, matured) }
        : { status: 'unavailable', reason: 'observation_coverage_incomplete' };
    const attendanceByPerson = new Map();
    for (const event of attendance) { if (!attendanceByPerson.has(event.person)) attendanceByPerson.set(event.person, []); attendanceByPerson.get(event.person).push(event); }
    const transitions = new Map(); let ambiguous = 0, sequencePeople = 0;
    for (const events of attendanceByPerson.values()) {
        const days = new Map();
        for (const event of events.filter(e => inRange(e.date, window.startDay, window.endDay))) { if (!days.has(event.date)) days.set(event.date, new Set()); days.get(event.date).add(event.program); }
        if ([...days.values()].some(programs => programs.size > 1)) { ambiguous++; continue; }
        const sequence = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([, programs]) => [...programs][0]);
        const distinct = sequence.filter((program, i) => !i || sequence[i - 1] !== program);
        if (distinct.length < 2) continue; sequencePeople++;
        const pairs = new Set();
        for (let i = 1; i < distinct.length; i++) pairs.add(JSON.stringify([distinct[i - 1], distinct[i]]));
        for (const pair of pairs) transitions.set(pair, (transitions.get(pair) || 0) + 1);
    }
    const flows = { status: 'calculated', sequence_people: sequencePeople, same_day_ambiguous_people: ambiguous,
        edges: [...transitions].sort(([a], [b]) => a.localeCompare(b)).map(([pair, people]) => { const [from_program, to_program] = JSON.parse(pair); return { from_program, to_program, people }; }) };
    const programTracking = [];
    for (const ref of programMap.keys()) {
        let mature = 0, ongoing = 0, returned = 0, moved = 0;
        for (const events of attendanceByPerson.values()) {
            const initial = events.filter(e => e.program === ref && inRange(e.date, window.startDay, window.endDay)).map(e => e.date).sort()[0]; if (!initial) continue;
            const end = shift(initial, followupDays + 1);
            if (end > today) { ongoing++; continue; }
            mature++;
            if (events.some(e => e.program === ref && e.date > initial && e.date < end)) returned++;
            if (events.some(e => e.program !== ref && e.date > initial && e.date < end)) moved++;
        }
        if (mature || ongoing) programTracking.push({ program_ref: ref, matured_people: mature, censored_people: ongoing,
            same_program_repeat_people: returned, same_program_repeat_rate: ratio(returned, mature), next_other_program_people: moved, next_other_program_rate: ratio(moved, mature) });
    }
    const total = rows => rows.reduce((sum, row) => ({ visits: sum.visits + row.visits, visit_days: sum.visit_days + 1, complete_minutes: sum.complete_minutes + row.complete_minutes,
        measured_sessions: sum.measured_sessions + row.measured_sessions, missing_checkout: sum.missing_checkout + row.missing_checkout }), { visits: 0, visit_days: 0, complete_minutes: 0, measured_sessions: 0, missing_checkout: 0 });
    const beforeRows = [], afterRows = []; let pairedPeople = 0, immaturePeople = 0, incompleteBaseline = 0;
    for (const [person, events] of attendanceByPerson) {
        const date = events.filter(e => inRange(e.date, window.startDay, window.endDay)).map(event => event.date).sort()[0]; if (!date) continue;
        const start = shift(date, -comparisonDays), afterStart = shift(date, 1), end = shift(date, comparisonDays + 1);
        if (end > today) { immaturePeople++; continue; }
        if (!validDay(coverage.logsStartDay) || !validDay(coverage.logsEndDay) || coverage.logsStartDay > start || coverage.logsEndDay < end) { incompleteBaseline++; continue; }
        pairedPeople++;
        beforeRows.push(...visits.filter(v => v.person === person && inRange(v.date, start, date)));
        afterRows.push(...visits.filter(v => v.person === person && inRange(v.date, afterStart, end)));
    }
    const before = total(beforeRows), after = total(afterRows);
    const beforeAfter = { status: incompleteBaseline ? 'incomplete' : 'calculated', days_each_side: comparisonDays,
        paired_people: pairedPeople, censored_people: immaturePeople, incomplete_baseline_people: incompleteBaseline, before, after,
        delta: { visit_days: after.visit_days - before.visit_days, complete_minutes: before.missing_checkout || after.missing_checkout ? null : after.complete_minutes - before.complete_minutes },
        mean_visit_days_before: ratio(before.visit_days, pairedPeople), mean_visit_days_after: ratio(after.visit_days, pairedPeople),
        duration_comparison: before.missing_checkout || after.missing_checkout ? 'incomplete' : 'calculated', inference: 'descriptive_only' };
    const attendanceReady = confirmedComplete && unconfirmedAttendance === 0 && missingProgramDate === 0;
    const originsReady = originsComplete && unknownOrigins === 0 && missingProgramDate === 0;
    const programCoverage = validDay(coverage.programsStartDay) && validDay(coverage.programsEndDay) && coverage.programsStartDay <= window.startDay && coverage.programsEndDay >= today;
    const attendanceUnavailable = { status: 'unavailable', reason: 'attendance_confirmation_missing' };
    const rates = attendanceReady && originsReady && source.capabilities?.confirmedAttendance === true && source.capabilities?.stateAtOccurrence === true ? { status: 'calculated', rows: occurrenceRates.sort((a, b) => a.program_ref.localeCompare(b.program_ref) || a.date.localeCompare(b.date)).map(row => {
        const capacity = programMap.get(row.program_ref)?.capacity;
        return { ...row, capacity_utilization: Number.isSafeInteger(capacity) && capacity > 0 ? row.attended / capacity : null };
    }) } : { status: 'unavailable', reason: 'historical_signup_state_provenance_or_confirmation_missing' };
    return { calculation: 'complete', period: { start: window.startDay, end_exclusive: window.endDay, observed_through: today },
        application_distribution: { status: originsReady ? 'calculated' : 'limited', definition: originsReady ? 'preregistered_current_JOIN_WAITLIST_distinct_programs' : 'current_response_distinct_programs_provenance_unknown', ...distribution(applications) },
        attendance_distribution: attendanceReady ? { status: recorded ? 'limited' : 'calculated', basis: recorded ? 'recorded_is_attended' : 'confirmed_attendance', ...distribution(attendance.filter(e => inRange(e.date, window.startDay, window.endDay))) } : attendanceUnavailable,
        revisits, flows: attendanceReady && (recorded || programCoverage) ? { ...flows, status: recorded ? 'limited' : 'calculated', basis: recorded ? 'available_recorded_attendance' : 'confirmed_attendance' } : { status: 'unavailable', reason: 'confirmation_or_coverage_missing' },
        program_retention: attendanceReady && programCoverage ? { status: 'calculated', rows: programTracking.sort((a, b) => a.program_ref.localeCompare(b.program_ref)) } : { status: 'unavailable', reason: 'confirmation_or_coverage_missing' },
        occurrence_rates: rates, before_after: attendanceReady ? { ...beforeAfter, basis: recorded ? 'recorded_attendance_anchor' : 'confirmed_attendance_anchor' } : attendanceUnavailable,
        quality: { programs_missing_date: missingProgramDate, unconfirmed_attendance_rows: unconfirmedAttendance, unknown_application_origins: unknownOrigins },
        publication: { status: 'review_required', reasons: ['linked_cohorts', 'small_or_complementary_cells', 'overlapping_queries'] } };
}
