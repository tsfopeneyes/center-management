// Wholly synthetic A-F acceptance fixture. Never a production query/export.
const users = ['A', 'B', 'C', 'D', 'E', 'F'].map(letter => ({ id: `synthetic-person-${letter}`, user_group: '청소년' }));
let id = 0;
const logs = [];
const visit = (letter, day, minutes, hour = 10) => {
    const user_id = `synthetic-person-${letter}`, start = `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`;
    logs.push({ id: ++id, user_id, type: 'CHECKIN', location_id: 'room', created_at: start });
    if (minutes != null) logs.push({ id: ++id, user_id, type: 'CHECKOUT', location_id: 'room', created_at: new Date(Date.parse(start) + minutes * 60000).toISOString() });
};
visit('A', '2025-12-20', null); visit('B', '2025-12-21', null); // prior visit-day known; duration unspecified
visit('A', '2026-01-01', 60); visit('A', '2026-01-01', 30, 13);
visit('B', '2026-01-01', 45); visit('C', '2026-01-01', 20);
visit('A', '2026-01-08', 50); visit('B', '2026-01-15', 40);
visit('A', '2026-01-22', 60); visit('D', '2026-01-31', null);
const notices = ['P1', 'P2'].map(ref => ({ id: ref, category: 'PROGRAM', program_date: '2026-01-01', created_at: '2025-12-01T00:00:00Z', program_status: 'OPEN', is_recruiting: true, capacity: 4 }));
const sessions = [['P1-first', 'P1', '2026-01-01'], ['P1-second', 'P1', '2026-01-08'], ['P2-first', 'P2', '2026-01-15'], ['P1-late', 'P1', '2026-01-31']].map(([id, notice_id, session_date]) => ({ id, notice_id, session_date, status: 'OPEN', voided_at: null }));
const response = (session_id, person, status, attended, origin = 'PREREGISTERED') => ({ session_id, user_id: `synthetic-person-${person}`, status, is_attended: attended, application_origin: origin, attendance_confirmed: true });
const sessionResponses = [response('P1-first', 'A', 'JOIN', true), response('P1-first', 'B', 'JOIN', true), response('P1-first', 'C', 'JOIN', false), response('P1-first', 'E', 'WAITLIST', false), response('P1-first', 'F', 'CANCELLED', false), response('P1-second', 'A', 'JOIN', true, 'WALK_IN'), response('P2-first', 'B', 'JOIN', true, 'WALK_IN'), response('P1-late', 'D', 'JOIN', true, 'WALK_IN')];
export const engagementFixture = { complete: true, coverage: { logsStartDay: '2025-12-01', logsEndDay: '2026-02-01', programsStartDay: '2025-12-01', programsEndDay: '2026-02-01', firstVisitHistoryComplete: false },
    capabilities: { confirmedAttendance: true, applicationOrigins: true, stateAtOccurrence: true }, datasets: { users, logs, staff: [], locations: [{ id: 'room' }], notices, sessions, sessionResponses, responses: [], openAttendance: [] } };
