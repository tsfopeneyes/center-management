import { format } from 'date-fns';
import { isAdminOrStaff } from './userUtils.js';
import { isCurrentProgramAttendee } from '../features/programs/application/responseState.js';

export function buildOperationProgramStats({ notices = [], responses = [], sessions = [], sessionResponses = [], openAttendance = [], users = [], targetUserIds, startDate, endDate, now = new Date() }) {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    const today = format(now, 'yyyy-MM-dd');
    const userMap = new Map(users.map(user => [user.id, user]));
    const noticeMap = new Map(notices.filter(notice => notice.category === 'PROGRAM').map(notice => [String(notice.id), notice]));
    const sessionNoticeIds = new Set(sessions.map(session => String(session.notice_id)));
    const result = { center: { count: 0, participants: 0, details: [] }, schoolChurch: { count: 0, participants: 0, details: [] }, totalCount: 0, totalParticipants: 0 };
    const inRange = day => day && day >= start && day <= end && day <= today;
    const eligible = row => row.user_id && !isAdminOrStaff(userMap.get(row.user_id));
    const targeted = row => eligible(row) && targetUserIds.has(row.user_id);
    const add = (notice, date, rows, sessionId = null, open = false) => {
        if (!inRange(date)) return;
        // An application, a closed status or a scheduled date alone does not prove operation.
        const attended = rows.filter(row => eligible(row) && (open || isCurrentProgramAttendee(row)));
        if (!attended.length) return;
        const attendCount = new Set(attended.filter(targeted).map(row => row.user_id)).size;
        const joinCount = open ? null : new Set(rows.filter(row => targeted(row) && row.status === 'JOIN').map(row => row.user_id)).size;
        const bucket = notice.program_type === 'SCHOOL_CHURCH' ? result.schoolChurch : result.center;
        bucket.details.push({ id: notice.id, sessionId, title: notice.title, target_regions: notice.target_regions, date, targetAttendCount: attendCount, targetJoinCount: joinCount });
        bucket.count++; bucket.participants += attendCount;
        result.totalCount++; result.totalParticipants += attendCount;
    };
    const bySession = new Map();
    for (const row of sessionResponses) { const key = String(row.session_id); if (!bySession.has(key)) bySession.set(key, []); bySession.get(key).push(row); }
    for (const session of sessions) {
        const notice = noticeMap.get(String(session.notice_id));
        if (!notice || session.voided_at || ['CANCELLED', 'VOIDED'].includes(session.status)) continue;
        add(notice, session.session_date, bySession.get(String(session.id)) || [], session.id);
    }
    for (const notice of noticeMap.values()) {
        // Migrated program-level responses remain history, never a duplicate occurrence.
        if (sessionNoticeIds.has(String(notice.id))) continue;
        if (notice.is_recruiting === false) {
            const byDay = new Map();
            for (const row of openAttendance.filter(row => String(row.notice_id) === String(notice.id))) {
                if (!byDay.has(row.attendance_date)) byDay.set(row.attendance_date, []);
                byDay.get(row.attendance_date).push(row);
            }
            for (const [date, rows] of byDay) add(notice, date, rows, null, true);
        } else {
            const date = String(notice.program_date || notice.created_at || '').slice(0, 10);
            add(notice, date, responses.filter(row => String(row.notice_id) === String(notice.id)));
        }
    }
    for (const bucket of [result.center, result.schoolChurch]) bucket.details.sort((a, b) => b.date.localeCompare(a.date));
    return result;
}
