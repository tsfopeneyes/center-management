import { useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';
import { fetchAllPages } from '../../../../utils/fetchAllPages';

const missingRelation = error => ['42P01', 'PGRST200', 'PGRST205'].includes(error?.code);

async function optionalRows(queryFactory) {
    try { return await fetchAllPages(queryFactory); }
    catch (error) { if (missingRelation(error)) return []; throw error; }
}

const add = (map, userId, key) => {
    if (!userId) return;
    if (!map.has(userId)) map.set(userId, new Set());
    map.get(userId).add(key);
};

const keepLatest = (map, userId, value, type) => {
    const date = String(value || '').slice(0, 10);
    if (!userId || !date) return;
    const sortAt = String(value || date);
    if (!map.has(userId) || sortAt > map.get(userId).sortAt) map.set(userId, { date, sortAt, type });
};

export default function useJourneyListStats(schoolLogs = []) {
    const [stats, setStats] = useState(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            const [checkins, legacy, daily, open] = await Promise.all([
                fetchAllPages(() => supabase.from('logs').select('id,user_id,created_at').eq('type', 'CHECKIN').order('created_at').order('id')),
                optionalRows(() => supabase.from('notice_responses').select('id,user_id,notice_id,created_at,notices(program_date)')
                    .eq('status', 'JOIN').eq('is_attended', true).order('created_at').order('id')),
                optionalRows(() => supabase.from('daily_program_session_responses')
                    .select('user_id,session_id,daily_program_sessions(notice_id,session_date,voided_at)')
                    .eq('is_attended', true).order('session_id').order('user_id')),
                optionalRows(() => supabase.from('open_program_attendance').select('user_id,notice_id,attendance_date').order('attendance_date').order('notice_id')),
            ]);
            if (!active) return;

            const visits = new Map();
            const programs = new Map();
            const meetings = new Map();
            const latest = new Map();
            (checkins || []).forEach(row => { add(visits, row.user_id, row.id); keepLatest(latest, row.user_id, row.created_at, 'VISIT'); });
            (daily || []).forEach(row => {
                const session = row.daily_program_sessions;
                if (!session || session.voided_at) return;
                add(programs, row.user_id, `${session.notice_id}:${session.session_date}`);
                keepLatest(latest, row.user_id, session.session_date, 'PROGRAM');
            });
            (open || []).forEach(row => { add(programs, row.user_id, `${row.notice_id}:${row.attendance_date}`); keepLatest(latest, row.user_id, row.attendance_date, 'PROGRAM'); });
            (legacy || []).forEach(row => {
                const date = String(row.notices?.program_date || row.created_at || '').slice(0, 10);
                add(programs, row.user_id, `${row.notice_id}:${date}`);
                keepLatest(latest, row.user_id, date, 'PROGRAM');
            });
            (schoolLogs || []).forEach(log => (log.participant_ids || []).forEach(userId => { add(meetings, userId, log.id); keepLatest(latest, userId, log.date, 'MEETING'); }));

            const userIds = new Set([...visits.keys(), ...programs.keys(), ...meetings.keys()]);
            setStats(new Map([...userIds].map(userId => [userId, {
                visits: visits.get(userId)?.size || 0,
                programs: programs.get(userId)?.size || 0,
                meetings: meetings.get(userId)?.size || 0,
                latest: latest.get(userId) || null,
            }])));
        };
        setLoading(true);
        load().catch(error => {
            console.error('Failed to load journey list stats:', error);
            if (active) setStats(new Map());
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [schoolLogs]);

    return { stats, loading };
}
