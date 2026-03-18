const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const date = '2026-02-20';
    const start = `${date}T00:00:00+09:00`;
    const end = `${date}T23:59:59+09:00`;

    const { data: users } = await supabase.from('users').select('*');
    const userMap = new Map(users.map(u => [u.id, u]));
    const isAdminOrStaff = (u) => u && (u.name === 'admin' || u.user_group === '관리자' || u.user_group === 'STAFF' || u.role === 'admin' || u.role === 'STAFF');
    const adminIds = new Set(users.filter(isAdminOrStaff).map(u => u.id));

    const { data: logs } = await supabase.from('logs').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true });
    const filteredLogs = logs.filter(l => !adminIds.has(l.user_id));

    const userDurations = {}; // { userId: duration }
    const userGroups = {};

    const activeSessions = new Map(); // { userId: { startTime } }

    filteredLogs.forEach(log => {
        const { user_id, type, created_at } = log;
        const logTime = new Date(created_at).getTime();

        if (activeSessions.has(user_id)) {
            const session = activeSessions.get(user_id);
            const dur = Math.floor((logTime - session.startTime) / 60000);
            if (dur > 0) {
                userDurations[user_id] = (userDurations[user_id] || 0) + dur;
            }
        }

        if (type === 'CHECKIN' || type === 'MOVE') {
            activeSessions.set(user_id, { startTime: logTime });
        } else if (type === 'CHECKOUT') {
            activeSessions.delete(user_id);
        }
    });

    console.log('--- User Duration Breakdown ---');
    let totalDur = 0;
    Object.entries(userDurations).forEach(([uid, dur]) => {
        const user = userMap.get(uid);
        const name = user ? user.name : 'Unknown';
        const group = user ? user.user_group : 'Unknown';
        console.log(`User: ${name} | Group: ${group} | Duration: ${Math.floor(dur / 60)}h ${dur % 60}m (${(dur / 60).toFixed(1)}h)`);
        totalDur += dur;
    });
    console.log(`Total: ${Math.floor(totalDur / 60)}h ${totalDur % 60}m`);
}

verify();
