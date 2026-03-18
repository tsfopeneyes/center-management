const { createClient } = require('@supabase/supabase-client');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const date = '2026-02-20';
    const start = `${date}T00:00:00+09:00`;
    const end = `${date}T23:59:59+09:00`;

    const { data: locations } = await supabase.from('locations').select('*');
    const targetLoc = locations.find(l => l.name === '이높플레이스');
    if (!targetLoc) {
        console.log('Location not found');
        return;
    }
    console.log(`Location ID: ${targetLoc.id}`);

    const { data: users } = await supabase.from('users').select('*');

    // Unified isAdminOrStaff logic
    const isAdminOrStaff = (user) => {
        if (!user) return false;
        return user.name === 'admin' ||
            user.user_group === '관리자' ||
            user.user_group === 'STAFF' ||
            user.role === 'admin' ||
            user.role === 'STAFF';
    };

    const adminIds = new Set(users.filter(isAdminOrStaff).map(u => u.id));

    const { data: logs } = await supabase
        .from('logs')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

    const filteredLogs = logs.filter(l => !adminIds.has(l.user_id));

    console.log(`Total non-admin logs for the day: ${filteredLogs.length}`);

    // Calculate metrics for this location
    const userCurrent = new Map();
    const segments = [];
    const spaceMetrics = {
        uniqueUsers: new Set(),
        visitCount: 0,
        totalDuration: 0
    };
    const userDateVisit = new Set();

    filteredLogs.forEach(log => {
        const userId = log.user_id;
        const logTime = new Date(log.created_at).getTime();
        const current = userCurrent.get(userId);

        if (current) {
            const duration = Math.floor((logTime - current.time) / (1000 * 60)); // minutes
            if (duration > 0 && current.locId === targetLoc.id) {
                segments.push({ userId, locId: current.locId, start: current.time, end: logTime, duration });
                spaceMetrics.totalDuration += duration;
                spaceMetrics.uniqueUsers.add(userId);

                const dateKey = `${userId}_${current.locId}_${date}`;
                if (!userDateVisit.has(dateKey)) {
                    userDateVisit.add(dateKey);
                    spaceMetrics.visitCount++;
                }
            }
        }

        if (log.type === 'CHECKIN' || log.type === 'MOVE') {
            userCurrent.set(userId, { locId: log.location_id, time: logTime });
        } else if (log.type === 'CHECKOUT') {
            userCurrent.delete(userId);
        }
    });

    console.log('--- Results ---');
    console.log(`Unique Visitors: ${spaceMetrics.uniqueUsers.size}`);
    console.log(`Visit Count: ${spaceMetrics.visitCount}`);
    console.log(`Total Duration: ${Math.floor(spaceMetrics.totalDuration / 60)}h ${spaceMetrics.totalDuration % 60}m`);
    console.log(`Avg Duration: ${spaceMetrics.visitCount > 0 ? Math.round(spaceMetrics.totalDuration / spaceMetrics.visitCount) : 0} min`);
}

verify();
