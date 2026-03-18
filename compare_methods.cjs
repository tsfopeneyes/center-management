const { createClient } = require('@supabase/supabase-js');
const { format, startOfDay, endOfDay, differenceInMinutes } = require('date-fns');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseKey);

const isAdminOrStaff = (u) => u && (u.name === 'admin' || u.user_group === '관리자' || u.user_group === 'STAFF' || u.role === 'admin' || u.role === 'STAFF');

const aggregateVisitSessions = (allLogs, users, locations, startDate, endDate) => {
    const isWithinRange = (dateStr) => dateStr >= startDate && dateStr <= endDate;
    const visitLogs = allLogs.filter(log => ['CHECKIN', 'CHECKOUT', 'MOVE'].includes(log.type));
    const userMap = new Map(users.map(u => [u.id, u]));
    const userDateGroups = {};

    visitLogs.forEach(log => {
        const date = new Date(log.created_at).toLocaleDateString('en-CA');
        if (!isWithinRange(date)) return;
        const groupKey = `${log.user_id}_${date}`;
        if (!userDateGroups[groupKey]) {
            const user = userMap.get(log.user_id);
            if (!user || isAdminOrStaff(user)) return;
            userDateGroups[groupKey] = { userId: log.user_id, name: user.name, rawLogs: [] };
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

        sessions.forEach(sessionLogs => {
            aggregated.push({ userId: group.userId, name: group.name, rawLogs: sessionLogs });
        });
    });
    return aggregated;
};

async function run() {
    const date = new Date(2026, 1, 20); // Feb 20
    const start = startOfDay(date);
    const end = endOfDay(date);

    const { data: locations } = await supabase.from('locations').select('*');
    const { data: users } = await supabase.from('users').select('*');
    const { data: logs } = await supabase.from('logs').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at');

    const adminIds = new Set(users.filter(isAdminOrStaff).map(u => u.id));
    const filteredLogs = logs.filter(l => !adminIds.has(l.user_id));

    // 1. Method A: ProcessAnalyticsData (Sessions)
    const sessions = aggregateVisitSessions(logs, users, locations, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    const statsResults = new Map();

    sessions.forEach(session => {
        const userId = session.userId;
        const durationLogs = session.rawLogs;
        if (durationLogs.length === 0) return;

        let sessionTotal = 0;
        let currentLocId = durationLogs[0].location_id;
        let segmentStart = new Date(durationLogs[0].created_at);

        durationLogs.forEach((log) => {
            if (log.type === 'MOVE') {
                const logTime = new Date(log.created_at);
                const duration = differenceInMinutes(logTime, segmentStart);
                if (duration > 0 && currentLocId) sessionTotal += duration;
                currentLocId = log.location_id;
                segmentStart = logTime;
            }
        });

        const lastLog = durationLogs[durationLogs.length - 1];
        if (lastLog.type === 'CHECKOUT') {
            const duration = differenceInMinutes(new Date(lastLog.created_at), segmentStart);
            if (duration > 0 && currentLocId) sessionTotal += duration;
        }
        statsResults.set(userId, (statsResults.get(userId) || 0) + sessionTotal);
    });

    // 2. Method B: ProcessOperationReport (Direct Loop)
    const reportResults = new Map();
    const userCurrent = new Map();
    filteredLogs.forEach(log => {
        const userId = log.user_id;
        const logTime = new Date(log.created_at);
        const current = userCurrent.get(userId);

        if (current) {
            const duration = differenceInMinutes(logTime, current.time);
            if (duration > 0) {
                reportResults.set(userId, (reportResults.get(userId) || 0) + duration);
            }
        }

        if (log.type === 'CHECKIN' || log.type === 'MOVE') {
            userCurrent.set(userId, { locId: log.location_id, time: logTime });
        } else if (log.type === 'CHECKOUT') {
            userCurrent.delete(userId);
        }
    });

    console.log('--- Comparison of Duration Calculation ---');
    console.log(`${'Name'.padEnd(10)} | ${'Stats'.padEnd(10)} | ${'Report'.padEnd(10)} | ${'Diff'.padEnd(10)}`);

    users.forEach(u => {
        const s = statsResults.get(u.id) || 0;
        const r = reportResults.get(u.id) || 0;
        if (s > 0 || r > 0) {
            console.log(`${u.name.padEnd(10)} | ${String(s).padEnd(10)} | ${String(r).padEnd(10)} | ${String(r - s).padEnd(10)}`);
        }
    });
}
run();
