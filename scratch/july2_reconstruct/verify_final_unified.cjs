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

    // 1. Logic shared by Stats and Report (The FIX)
    let unifiedTotal = 0;
    let youthTotal = 0;

    sessions.forEach(session => {
        const user = userMap.get(session.userId);
        const durationLogs = session.rawLogs;
        let sessionDur = 0;
        let segmentStart = new Date(durationLogs[0].created_at);

        durationLogs.forEach((log) => {
            if (log.type === 'MOVE') {
                sessionDur += differenceInMinutes(new Date(log.created_at), segmentStart);
                segmentStart = new Date(log.created_at);
            }
        });
        if (durationLogs[durationLogs.length - 1].type === 'CHECKOUT') {
            sessionDur += differenceInMinutes(new Date(durationLogs[durationLogs.length - 1].created_at), segmentStart);
        }

        unifiedTotal += sessionDur;
        if (user && user.user_group === '청소년') youthTotal += sessionDur;
    });

    console.log(`Unified Total (All): ${Math.floor(unifiedTotal / 60)}h ${unifiedTotal % 60}m`);
    console.log(`Youth Total (청소년): ${Math.floor(youthTotal / 60)}h ${youthTotal % 60}m`);
}
run();
