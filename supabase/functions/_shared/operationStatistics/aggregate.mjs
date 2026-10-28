import { POLICY, StatisticsError, dayKst, validDay } from './policy.mjs';
import { SOURCE_NAMES } from './source.mjs';

const key = (...parts) => JSON.stringify(parts);
const EVENT_ORDER = { CHECKIN: 0, MOVE: 1, CHECKOUT: 2 };
function unique(rows, fields, identity) {
    const seen = new Map();
    for (const input of rows) {
        const row = Object.fromEntries(fields.map(field => [field, input[field]]));
        const id = identity(row), prior = seen.get(id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new StatisticsError('source_incomplete');
        seen.set(id, row);
    }
    return [...seen.values()];
}
function eligibility(users, staff) {
    const people = new Map(users.map(row => [row.id, row]));
    const employees = new Set(staff.filter(row => ['admin', 'master'].includes(row.role)).map(row => row.id));
    return { people, eligible: id => typeof id === 'string' && people.has(id) && !employees.has(id) };
}
const inWindow = (day, window) => {
    if (!validDay(day)) throw new StatisticsError('source_incomplete');
    return day >= window.startDay && day < window.endDay;
};

// Server-internal calculation only: exact counters and risk diagnostics, no person
// identifiers, timestamps, raw rows or labels are returned. Publication is separate.
export function calculateVisitStatistics({ logs = [], users = [], staff = [], locations = [], window,
    now = new Date(), locationIds = null }) {
    const { people, eligible } = eligibility(users, staff);
    const validLocations = new Set(locations.map(row => String(row.id)));
    const targetLocations = locationIds ? new Set(locationIds.map(String)) : validLocations;
    const sorted = unique(logs, ['id', 'user_id', 'type', 'location_id', 'created_at'], row => key(row.id))
        .filter(row => eligible(row.user_id) && Object.hasOwn(EVENT_ORDER, row.type) && inWindow(dayKst(row.created_at), window) && Date.parse(row.created_at) <= now.getTime())
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || EVENT_ORDER[a.type] - EVENT_ORDER[b.type] || String(a.id).localeCompare(String(b.id)));
    const groups = new Map();
    for (const row of sorted) {
        const id = key(row.user_id, dayKst(row.created_at));
        if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row);
    }
    const visitors = new Set(), members = new Set(), guestPeople = new Set(), userDays = new Set(), durationPeople = new Set();
    const perPersonMinutes = new Map(), measuredMinutes = [];
    let sessions = 0, memberSpaceVisits = 0, guestSpaceVisits = 0, recorded = 0, complete = 0,
        validSessions = 0, missingCheckout = 0, estimated = 0, orphanCheckouts = 0, invalidLocations = 0, zeroSessions = 0, overlappingCheckins = 0;
    for (const rows of groups.values()) {
        const blocks = []; let block = [], closed = false;
        for (const row of rows) {
            if (row.type === 'CHECKIN' && closed) { blocks.push(block); block = []; closed = false; }
            if (!block.length && row.type === 'CHECKOUT') { orphanCheckouts++; continue; }
            if (row.type === 'CHECKIN' && !closed && block.some(event => event.type === 'CHECKIN')) overlappingCheckins++;
            if (closed && row.type === 'MOVE') continue; // A MOVE cannot reopen an ended session.
            block.push(row); if (row.type === 'CHECKOUT') closed = true;
        }
        if (block.length) blocks.push(block);
        for (const events of blocks) {
            const first = events.find(row => row.type === 'CHECKIN') || events.find(row => row.type === 'MOVE');
            if (!first) continue;
            const user = people.get(first.user_id), guest = ['게스트', '미가입'].includes(user.user_group);
            const checkout = [...events].reverse().find(row => row.type === 'CHECKOUT');
            const touched = new Set(), positive = new Set();
            let location = String(first.location_id), at = Date.parse(first.created_at), minutes = 0;
            if (validLocations.has(location) && targetLocations.has(location)) touched.add(location);
            const record = end => {
                const duration = Math.max(0, Math.floor((end - at) / 60_000));
                if (duration > 0 && validLocations.has(location) && targetLocations.has(location)) {
                    minutes += duration; positive.add(location);
                }
            };
            for (const event of events) {
                if (Date.parse(event.created_at) < Date.parse(first.created_at)) continue;
                if (event.type === 'MOVE') {
                    record(Date.parse(event.created_at)); location = String(event.location_id); at = Date.parse(event.created_at);
                    if (validLocations.has(location) && targetLocations.has(location)) touched.add(location);
                }
            }
            if (checkout) record(Date.parse(checkout.created_at));
            if (!touched.size) { invalidLocations++; continue; }
            const countLocations = touched;
            if (countLocations.size) {
                sessions++; visitors.add(first.user_id); userDays.add(key(first.user_id, dayKst(first.created_at)));
                if (guest) { guestSpaceVisits += countLocations.size; guestPeople.add(first.user_id); }
                else { memberSpaceVisits += positive.size; members.add(first.user_id); }
                recorded += minutes;
            }
            if (checkout && minutes > 0) {
                complete += minutes; validSessions++; durationPeople.add(first.user_id);
                measuredMinutes.push(minutes);
                perPersonMinutes.set(first.user_id, (perPersonMinutes.get(first.user_id) || 0) + minutes);
            }
            if (minutes === 0) zeroSessions++;
            if (!checkout) {
                missingCheckout++;
                const day = dayKst(first.created_at), closeAt = Date.parse(day + 'T22:00:00+09:00');
                const end = day < dayKst(now.toISOString()) || now.getTime() >= closeAt ? closeAt : now.getTime();
                estimated += Math.max(0, Math.floor((end - Date.parse(first.created_at)) / 60_000));
            }
        }
    }
    return { visits: { visit_sessions: sessions, unique_visitors: visitors.size, member_space_visits: memberSpaceVisits,
        guest_space_visits: guestSpaceVisits, member_unique_visitors: members.size, guest_unique_visitors: guestPeople.size,
        visitor_days: userDays.size },
    duration: { recorded_minutes: recorded, complete_minutes: complete, valid_sessions: validSessions,
        mean_complete_minutes: validSessions ? complete / validSessions : null,
        median_complete_minutes: measuredMinutes.length ? (() => { const sorted = [...measuredMinutes].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; })() : null,
        partial_recorded_minutes: recorded - complete,
        estimated_missing_checkout_minutes: estimated, missing_checkout_sessions: missingCheckout },
    risk: { visitor_subjects: visitors.size, duration_subjects: durationPeople.size,
        largest_duration_share: complete ? Math.max(0, ...perPersonMinutes.values()) / complete : 0 },
    quality: { orphan_checkouts: orphanCheckouts, invalid_location_sessions: invalidLocations, zero_duration_sessions: zeroSessions, overlapping_checkins: overlappingCheckins } };
}

export function calculateProgramStatistics({ notices = [], responses = [], sessions = [], sessionResponses = [],
    openAttendance = [], users = [], staff = [], window, now = new Date() }) {
    notices = unique(notices, ['id', 'category', 'program_date', 'created_at', 'program_status', 'is_recruiting'], row => key(row.id));
    sessions = unique(sessions, ['id', 'notice_id', 'session_date', 'status', 'voided_at'], row => key(row.id));
    responses = unique(responses, ['notice_id', 'user_id', 'status', 'is_attended', 'is_staff'], row => key(row.notice_id, row.user_id));
    sessionResponses = unique(sessionResponses, ['session_id', 'user_id', 'status', 'is_attended'], row => key(row.session_id, row.user_id));
    openAttendance = unique(openAttendance, ['notice_id', 'user_id', 'attendance_date'], row => key(row.notice_id, row.user_id, row.attendance_date));
    const { eligible } = eligibility(users, staff);
    const programs = new Map(notices.filter(row => row.category === 'PROGRAM' && row.program_status !== 'CANCELLED')
        .map(row => [String(row.id), row]));
    const migrated = new Set(sessions.map(row => String(row.notice_id)));
    const occurrences = [], populations = new Map(), applicants = new Map();
    const add = (noticeId, occurrenceId, date, rows, open = false) => {
        if (!inWindow(date, window)) return;
        const scoped = unique(rows.filter(row => eligible(row.user_id) && row.is_staff !== true),
            ['user_id', 'status', 'is_attended'], row => key(row.user_id));
        const counts = { joined: 0, waitlisted: 0, cancelled: 0, attended: 0, application_records: 0 };
        const population = new Set(), applicantPopulation = new Set();
        for (const row of scoped) {
            if (!open && ['JOIN', 'WAITLIST', 'CANCELLED'].includes(row.status)) {
                population.add(row.user_id); counts.application_records++;
                applicantPopulation.add(row.user_id);
                counts[row.status === 'JOIN' ? 'joined' : row.status === 'WAITLIST' ? 'waitlisted' : 'cancelled']++;
            }
            if (date <= dayKst(now.toISOString()) && (open || row.status === 'JOIN' && row.is_attended === true)) { counts.attended++; population.add(row.user_id); }
        }
        occurrences.push({ program_ref: noticeId, occurrence_ref: occurrenceId, date, ...counts, unique_applicants: applicantPopulation.size, subjects: population.size });
        if (!applicants.has(noticeId)) applicants.set(noticeId, new Set());
        for (const id of applicantPopulation) applicants.get(noticeId).add(id);
        if (!populations.has(noticeId)) populations.set(noticeId, new Set());
        for (const id of population) populations.get(noticeId).add(id);
    };
    for (const session of sessions) {
        if (!programs.has(String(session.notice_id)) || session.voided_at || ['VOIDED', 'CANCELLED'].includes(session.status)) continue;
        add(String(session.notice_id), String(session.id), session.session_date,
            sessionResponses.filter(row => String(row.session_id) === String(session.id)));
    }
    for (const notice of programs.values()) {
        if (migrated.has(String(notice.id))) continue;
        if (notice.is_recruiting === false) {
            const rows = openAttendance.filter(row => String(row.notice_id) === String(notice.id));
            for (const day of new Set(rows.map(row => row.attendance_date))) add(String(notice.id), `open:${day}`, day, rows.filter(row => row.attendance_date === day), true);
        } else {
            const date = notice.program_date || notice.created_at;
            if (!date) throw new StatisticsError('source_incomplete');
            add(String(notice.id), 'whole', validDay(date) ? date : dayKst(date), responses.filter(row => String(row.notice_id) === String(notice.id)));
        }
    }
    const fields = ['joined', 'waitlisted', 'cancelled', 'attended', 'application_records'];
    const sum = rows => Object.fromEntries(fields.map(field => [field, rows.reduce((total, row) => total + row[field], 0)]));
    const details = [...new Set(occurrences.map(row => row.program_ref))].sort().map(ref => ({ program_ref: ref,
        ...sum(occurrences.filter(row => row.program_ref === ref)), unique_applicants: applicants.get(ref).size, subjects: populations.get(ref).size }));
    const all = new Set([...populations.values()].flatMap(set => [...set]));
    const distinctApplicants = new Set([...applicants.values()].flatMap(set => [...set]));
    return { summary: { ...sum(occurrences), unique_applicants: distinctApplicants.size }, details, occurrences, risk: { subjects: all.size } };
}

export function calculateStatistics(source, window, now = new Date()) {
    if (source?.complete !== true || !source.datasets || SOURCE_NAMES.some(name => !Array.isArray(source.datasets[name])))
        throw new StatisticsError('source_incomplete');
    const visit = calculateVisitStatistics({ ...source.datasets, window, now });
    const program = calculateProgramStatistics({ ...source.datasets, window, now });
    return { version: POLICY.version, window, ...visit, programs: program };
}
