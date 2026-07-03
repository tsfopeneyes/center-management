const { createClient } = require('@supabase/supabase-js');
const { format, startOfDay, endOfDay, differenceInMinutes } = require('date-fns');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);

const getKSTDateString = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const isAdminOrStaff = (u) => u && (u.name === 'admin' || u.user_group === '관리자' || u.user_group === 'STAFF' || u.role === 'admin' || u.role === 'STAFF');

const aggregateVisitSessions = (allLogs, users, locations, startDate, endDate) => {
    const isWithinRange = (dateStr) => dateStr >= startDate && dateStr <= endDate;
    const visitLogs = allLogs.filter(log => ['CHECKIN', 'CHECKOUT', 'MOVE'].includes(log.type));
    const userMap = new Map(users.map(u => [u.id, u]));
    const userDateGroups = {};

    visitLogs.forEach(log => {
        const date = getKSTDateString(log.created_at);
        if (!isWithinRange(date)) return;
        const groupKey = `${log.user_id}_${date}`;
        if (!userDateGroups[groupKey]) {
            const user = userMap.get(log.user_id);
            if (!user || isAdminOrStaff(user)) return;
            userDateGroups[groupKey] = { userId: log.user_id, rawLogs: [], date };
        }
        if (userDateGroups[groupKey]) userDateGroups[groupKey].rawLogs.push(log);
    });

    const aggregated = [];
    Object.values(userDateGroups).forEach(group => {
        const sortedLogs = [...group.rawLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const sessions = [];
        let currentLogs = [];
        let sessionHasCheckout = false;
        sortedLogs.forEach(log => {
            if (log.type === 'CHECKIN' && sessionHasCheckout) {
                sessions.push(currentLogs);
                currentLogs = [];
                sessionHasCheckout = false;
            }
            currentLogs.push(log);
            if (log.type === 'CHECKOUT') sessionHasCheckout = true;
        });
        if (currentLogs.length > 0) sessions.push(currentLogs);
        sessions.forEach(sessionLogs => aggregated.push({ userId: group.userId, rawLogs: sessionLogs, date: group.date }));
    });
    return aggregated;
};

async function run() {
    const date = new Date(2026, 1, 20); // Feb 20
    const start = startOfDay(date);
    const end = endOfDay(date);

    const { data: users } = await supabase.from('users').select('*');
    const { data: logs } = await supabase.from('logs').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at');
    const { data: locations } = await supabase.from('locations').select('*');

    const sessions = aggregateVisitSessions(logs, users, locations, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    const userMap = new Map(users.map(u => [u.id, u]));
    const targetRoomId = '하이픈 5층 회의실'; // 이높플레이스

    let youthTargetRoomDur = 0;

    sessions.forEach(session => {
        const user = userMap.get(session.userId);
        if (!user || user.user_group !== '청소년') return;

        const durationLogs = session.rawLogs;
        let currentLocId = durationLogs[0].location_id;
        let segmentStart = new Date(durationLogs[0].created_at);

        durationLogs.forEach((log) => {
            if (log.type === 'MOVE') {
                const logTime = new Date(log.created_at);
                const duration = differenceInMinutes(logTime, segmentStart);
                if (currentLocId === targetRoomId) youthTargetRoomDur += duration;

                currentLocId = log.location_id;
                segmentStart = logTime;
            }
        });

        const lastLog = durationLogs[durationLogs.length - 1];
        if (lastLog.type === 'CHECKOUT') {
            const duration = differenceInMinutes(new Date(lastLog.created_at), segmentStart);
            if (currentLocId === targetRoomId) youthTargetRoomDur += duration;
        }
    });

    console.log(`Youth Duration in 이높플레이스: ${Math.floor(youthTargetRoomDur / 60)}h ${youthTargetRoomDur % 60}m (${(youthTargetRoomDur / 60).toFixed(1)}h)`);
}
run();
