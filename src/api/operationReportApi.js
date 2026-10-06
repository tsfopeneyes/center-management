import { supabase } from '../supabaseClient';
import { fetchAllPages } from '../utils/fetchAllPages';

export async function fetchOperationReportAttendance(start, end) {
    const [sessions, sessionResponses, openAttendance] = await Promise.all([
        fetchAllPages(() => supabase.from('daily_program_sessions').select('id,notice_id,session_date,status,voided_at').order('id')),
        fetchAllPages(() => supabase.from('daily_program_session_responses').select('session_id,user_id,status,is_attended').order('session_id').order('user_id')),
        fetchAllPages(() => supabase.from('open_program_attendance').select('notice_id,user_id,attendance_date').gte('attendance_date', start).lte('attendance_date', end).order('notice_id').order('attendance_date').order('user_id')),
    ]);
    return { sessions, sessionResponses, openAttendance };
}
