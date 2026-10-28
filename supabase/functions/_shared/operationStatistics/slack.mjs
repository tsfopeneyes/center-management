import { calculateVisitStatistics, calculateProgramStatistics } from './aggregate.mjs';
import { dayKst } from './policy.mjs';

export function slackWindow(start, end) {
    return { start: start.toISOString(), end: end.toISOString(), startDay: dayKst(start.toISOString()), endDay: dayKst(end.toISOString()) };
}
// Additive fields only. Legacy Slack fields and its existing authorization stay.
export function slackVisitStatistics(input, complete) {
    if (!complete) return { status: 'incomplete' };
    try {
        const { visits, duration, quality } = calculateVisitStatistics(input);
        return { status: 'available', visits, duration, quality };
    } catch { return { status: 'incomplete' }; }
}
export async function slackProgramStatistics({ notices, responses, complete, read, window, loadResponses = false, now = new Date() }) {
    if (!complete) return { status: 'incomplete' };
    try {
        const definitions = [
            ...(loadResponses ? [['responses', 'notice_responses', 'notice_id,user_id,status,is_attended,is_staff']] : []),
            ['users', 'users', 'id,user_group'], ['staff', 'staff_directory', 'id,role'],
            ['sessions', 'daily_program_sessions', 'id,notice_id,session_date,status,voided_at'],
            ['sessionResponses', 'daily_program_session_responses', 'session_id,user_id,status,is_attended'],
            ['openAttendance', 'open_program_attendance', 'notice_id,user_id,attendance_date'],
        ];
        const datasets = {};
        for (const [name, table, select] of definitions) {
            const result = await read(table, select);
            if (!result || result.truncated !== false || !Array.isArray(result.rows)) return { status: 'incomplete' };
            datasets[name] = result.rows;
        }
        const { summary, details, occurrences } = calculateProgramStatistics({ ...datasets, notices, responses: loadResponses ? datasets.responses : responses, window, now });
        return { status: 'available', summary, details, occurrences };
    } catch { return { status: 'incomplete' }; }
}
