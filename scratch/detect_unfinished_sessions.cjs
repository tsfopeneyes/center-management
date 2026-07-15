const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSessions() {
    try {
        console.log('Fetching users, locations, and ALL logs...');
        
        // Fetch all users and locations
        const [
            { data: users, error: usersErr },
            { data: locations, error: locationsErr }
        ] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('locations').select('*')
        ]);

        if (usersErr) throw usersErr;
        if (locationsErr) throw locationsErr;

        // Fetch all logs using pagination
        let allLogs = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('logs')
                .select('*')
                .order('created_at', { ascending: true })
                .range(from, to);

            if (error) throw error;
            allLogs = allLogs.concat(data);

            if (data.length < 1000) {
                hasMore = false;
            } else {
                from += 1000;
                to += 1000;
            }
        }

        console.log(`Loaded ${users.length} users, ${locations.length} locations, and ${allLogs.length} logs.`);

        const userMap = new Map(users.map(u => [u.id, u]));
        const locationMap = new Map(locations.map(l => [l.id, l]));

        // Group logs by user
        const userLogs = {};
        allLogs.forEach(log => {
            if (!userLogs[log.user_id]) userLogs[log.user_id] = [];
            userLogs[log.user_id].push(log);
        });

        const activeSessions = [];

        Object.entries(userLogs).forEach(([userId, uLogs]) => {
            const user = userMap.get(userId);
            if (!user) return; // skip if user not found

            let currentCheckIn = null;
            let currentMoves = [];

            uLogs.forEach(log => {
                if (log.type === 'CHECKIN') {
                    currentCheckIn = log;
                    currentMoves = [];
                } else if (log.type === 'MOVE') {
                    if (currentCheckIn) {
                        currentMoves.push(log);
                    }
                } else if (log.type === 'CHECKOUT') {
                    currentCheckIn = null;
                    currentMoves = [];
                }
            });

            if (currentCheckIn) {
                activeSessions.push({
                    user,
                    checkIn: currentCheckIn,
                    moves: currentMoves
                });
            }
        });

        console.log(`\nFound ${activeSessions.length} active (unfinished) sessions:`);
        activeSessions.forEach(session => {
            const checkInLocal = new Date(session.checkIn.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            const loc = locationMap.get(session.checkIn.location_id);
            console.log(`- [${session.user.name}] (${session.user.school || 'No school'}) Checked-in at: ${checkInLocal} in [${loc ? loc.name : 'Unknown'}] (log_id: ${session.checkIn.id})`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

checkSessions();
