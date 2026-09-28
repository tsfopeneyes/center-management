import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../supabaseClient';
import { fetchAllPages } from '../../../../utils/fetchAllPages';
import { aggregateVisitSessions } from '../../../../utils/visitUtils';

const missingRelation = error => ['42P01', 'PGRST200', 'PGRST205'].includes(error?.code);
const dateValue = value => String(value || '').slice(0, 10);
const durationLabel = value => {
    const minutes = parseInt(value, 10) || 0;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return `${hours}시간 ${rest}분`;
    if (hours) return `${hours}시간`;
    return `${rest}분`;
};
const parseTime = value => {
    const [hourValue, minuteValue] = String(value || '').split(':').map(Number);
    if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return null;
    return { hour: hourValue, minute: minuteValue, period: hourValue < 12 ? '오전' : '오후' };
};
const naturalTimeRange = (startValue, endValue) => {
    const start = parseTime(startValue);
    const end = parseTime(endValue);
    if (!start || !end || endValue === '-') return `${startValue || '-'} ~ ${endValue || '-'}`;
    const clock = time => `${time.hour % 12 || 12}시${time.minute ? ` ${time.minute}분` : ''}`;
    return `${start.period} ${clock(start)} ~ ${start.period === end.period ? '' : `${end.period} `}${clock(end)}`;
};

async function optionalRows(queryFactory) {
    try { return await fetchAllPages(queryFactory); }
    catch (error) { if (missingRelation(error)) return []; throw error; }
}

export default function useUserJourney({ user, locations, schoolLogs, visitNotes, feedbacks, checkoutSurveyEntries }) {
    const [rawLogs, setRawLogs] = useState([]);
    const [programEvents, setProgramEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        if (!user?.id) {
            setRawLogs([]);
            setProgramEvents([]);
            return () => { active = false; };
        }
        setLoading(true);
        setError('');

        const load = async () => {
            const [logs, legacyResponses, dailyResponses, openAttendance] = await Promise.all([
                fetchAllPages(() => supabase.from('logs').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).order('id')),
                optionalRows(() => supabase.from('notice_responses')
                    .select('id,notice_id,status,is_attended,created_at,notices(id,title,category,program_date,content)')
                    .eq('user_id', user.id).eq('status', 'JOIN').eq('is_attended', true)
                    .order('created_at', { ascending: true }).order('id')),
                optionalRows(() => supabase.from('daily_program_session_responses')
                    .select('session_id,status,is_attended,created_at,daily_program_sessions(id,notice_id,session_date,starts_at,voided_at,notices(id,title,category,program_date,content))')
                    .eq('user_id', user.id).eq('is_attended', true)
                    .order('created_at', { ascending: true }).order('session_id')),
                optionalRows(() => supabase.from('open_program_attendance')
                    .select('notice_id,attendance_date,created_at,notices(id,title,category,program_date,content)')
                    .eq('user_id', user.id).order('attendance_date', { ascending: true }).order('notice_id')),
            ]);

            if (!active) return;
            const events = [];
            const seen = new Set();

            (dailyResponses || []).forEach(response => {
                const session = response.daily_program_sessions;
                if (!session || session.voided_at) return;
                const date = session.session_date || dateValue(session.starts_at);
                const key = `program:${session.notice_id}:${date}`;
                if (seen.has(key)) return;
                seen.add(key);
                events.push({ key, noticeId: session.notice_id, date, title: session.notices?.title || '프로그램', kind: '회차 프로그램' });
            });
            (openAttendance || []).forEach(row => {
                const key = `program:${row.notice_id}:${row.attendance_date}`;
                if (seen.has(key)) return;
                seen.add(key);
                events.push({ key, noticeId: row.notice_id, date: row.attendance_date, title: row.notices?.title || '오픈 프로그램', kind: '오픈 프로그램' });
            });
            (legacyResponses || []).forEach(row => {
                const date = dateValue(row.notices?.program_date || row.created_at);
                const key = `program:${row.notice_id}:${date}`;
                if (seen.has(key)) return;
                seen.add(key);
                events.push({ key, noticeId: row.notice_id, date, title: row.notices?.title || '프로그램', kind: '프로그램' });
            });

            setRawLogs(logs || []);
            setProgramEvents(events.sort((a, b) => String(b.date).localeCompare(String(a.date))));
        };

        load().catch(loadError => {
            if (!active) return;
            console.error('Failed to load user journey:', loadError);
            setError('이용자 여정 일부를 불러오지 못했습니다. 다시 시도해 주세요.');
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [user?.id]);

    const sessions = useMemo(() => user ? aggregateVisitSessions(rawLogs, [user], locations || []) : [], [rawLogs, user, locations]);
    const meetingLogs = useMemo(() => (schoolLogs || [])
        .filter(log => log.participant_ids?.includes(user?.id))
        .sort((a, b) => String(b.date).localeCompare(String(a.date))), [schoolLogs, user?.id]);
    const userVisitNotes = useMemo(() => (visitNotes || []).filter(note => note.user_id === user?.id), [visitNotes, user?.id]);
    const userFeedbacks = useMemo(() => (feedbacks || []).filter(item => item.user_id === user?.id), [feedbacks, user?.id]);
    const userSurveys = useMemo(() => (checkoutSurveyEntries || []).filter(item => item.user_id === user?.id), [checkoutSurveyEntries, user?.id]);

    const noteByDate = useMemo(() => new Map(userVisitNotes.map(note => [dateValue(note.visit_date), note])), [userVisitNotes]);
    const averageMinutes = useMemo(() => {
        const countable = sessions.filter(session => session.hasActualCheckout && session.rawLogs?.some(log => log.type === 'CHECKIN'));
        if (!countable.length) return null;
        return Math.round(countable.reduce((sum, session) => sum + (parseInt(session.durationMin, 10) || 0), 0) / countable.length);
    }, [sessions]);

    const timeline = useMemo(() => {
        const items = [];
        const datesWithDisplayedVisitNote = new Set();
        sessions.forEach(session => {
            const note = datesWithDisplayedVisitNote.has(session.date) ? null : noteByDate.get(session.date);
            if (note) datesWithDisplayedVisitNote.add(session.date);
            items.push({ id: `visit:${session.id}`, type: 'VISIT', date: session.date, sortAt: session.rawLogs?.[0]?.created_at || session.date,
                title: `${session.usedSpaces || '센터'} 방문`, summary: `${naturalTimeRange(session.startTime, session.endTime)} (${durationLabel(session.durationMin)})`, session, note });
        });
        meetingLogs.forEach(log => items.push({ id: `meeting:${log.id}`, type: 'MEETING', date: dateValue(log.date), sortAt: `${dateValue(log.date)}T23:59:00+09:00`,
            title: '학생 만남', summary: '', log }));
        programEvents.forEach(event => {
            const eventFeedbacks = userFeedbacks.filter(item => String(item.notice_id) === String(event.noticeId));
            items.push({ id: event.key, type: 'PROGRAM', date: event.date, sortAt: `${event.date}T12:00:00+09:00`,
                title: event.title, summary: `${event.kind} 참여${eventFeedbacks.length ? ` · 후기 ${eventFeedbacks.length}건` : ''}`, event, feedbacks: eventFeedbacks });
        });
        userSurveys.forEach(item => items.push({ id: `survey:${item.id}`, type: 'SURVEY', date: dateValue(item.created_at), sortAt: item.created_at,
            title: '방문 설문 응답', summary: '퇴실 시 작성한 응답', survey: item }));
        return items.sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)));
    }, [sessions, meetingLogs, programEvents, userFeedbacks, userSurveys, noteByDate]);

    return { loading, error, sessions, meetingLogs, programEvents, averageMinutes, timeline };
}
