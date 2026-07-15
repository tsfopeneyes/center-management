const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function getKSTDateString(dateInput) {
    const d = new Date(dateInput);
    // Add 9 hours for KST
    const kstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return kstDate.toISOString().split('T')[0];
}

async function runCleanup(dryRun = true) {
    try {
        console.log(`Starting cleanup (Dry-Run: ${dryRun})...`);
        
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

        const userMap = new Map(users.map(u => [u.id, u]));
        const locationMap = new Map(locations.map(l => [l.id, l]));

        // Fetch all logs
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

        console.log(`Loaded ${allLogs.length} logs.`);

        // Group logs by user
        const userLogs = {};
        allLogs.forEach(log => {
            if (!userLogs[log.user_id]) userLogs[log.user_id] = [];
            userLogs[log.user_id].push(log);
        });

        const inserts = [];
        const deletes = [];

        Object.entries(userLogs).forEach(([userId, uLogs]) => {
            const user = userMap.get(userId);
            if (!user) return;

            // Sort uLogs chronologically just in case
            uLogs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            for (let i = 0; i < uLogs.length; i++) {
                const log = uLogs[i];
                if (log.type === 'CHECKIN') {
                    const checkInTime = new Date(log.created_at);
                    const kstDateStr = getKSTDateString(log.created_at);
                    
                    // Threshold: 10:05 PM KST of check-in day
                    const thresholdKST = new Date(`${kstDateStr}T22:05:00+09:00`);
                    const targetCheckoutTimeKST = new Date(`${kstDateStr}T22:00:00+09:00`);

                    // Find if there is a checkout before the next checkin
                    let checkoutLog = null;
                    for (let j = i + 1; j < uLogs.length; j++) {
                        const nextLog = uLogs[j];
                        if (nextLog.type === 'CHECKIN') {
                            break;
                        }
                        if (nextLog.type === 'CHECKOUT') {
                            checkoutLog = nextLog;
                            break;
                        }
                    }

                    if (checkoutLog) {
                        const checkOutTime = new Date(checkoutLog.created_at);
                        if (checkOutTime > thresholdKST) {
                            // Spurious late checkout!
                            deletes.push({
                                logId: checkoutLog.id,
                                userName: user.name,
                                userSchool: user.school,
                                origTime: checkOutTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
                                reason: `Spurious checkout after 10:05 PM KST (${checkOutTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`
                            });

                            inserts.push({
                                user_id: userId,
                                location_id: log.location_id,
                                type: 'CHECKOUT',
                                created_at: targetCheckoutTimeKST.toISOString(),
                                userName: user.name,
                                userSchool: user.school,
                                timeStr: targetCheckoutTimeKST.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
                                reason: `Auto-checkout at 10:00 PM KST for check-in at ${checkInTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                            });
                        }
                    } else {
                        // Unfinished session (never checked out)
                        inserts.push({
                            user_id: userId,
                            location_id: log.location_id,
                            type: 'CHECKOUT',
                            created_at: targetCheckoutTimeKST.toISOString(),
                            userName: user.name,
                            userSchool: user.school,
                            timeStr: targetCheckoutTimeKST.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
                            reason: `Auto-checkout at 10:00 PM KST for unfinished check-in at ${checkInTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                        });
                    }
                }
            }
        });

        console.log(`\n--- Plan: ${inserts.length} Inserts, ${deletes.length} Deletes ---`);
        
        console.log('\nPlanned DELETES:');
        deletes.forEach(d => {
            console.log(`- Delete checkout log ${d.logId} for [${d.userName}] (${d.userSchool}) at ${d.origTime} (Reason: ${d.reason})`);
        });

        console.log('\nPlanned INSERTS:');
        inserts.forEach(ins => {
            console.log(`- Insert checkout for [${ins.userName}] (${ins.userSchool}) at ${ins.timeStr} (Reason: ${ins.reason})`);
        });

        if (!dryRun) {
            console.log('\nExecuting changes...');
            
            // Delete logs
            if (deletes.length > 0) {
                const deleteIds = deletes.map(d => d.logId);
                const { error: delErr } = await supabase
                    .from('logs')
                    .delete()
                    .in('id', deleteIds);
                if (delErr) throw delErr;
                console.log(`Successfully deleted ${deletes.length} logs.`);
            }

            // Insert logs
            if (inserts.length > 0) {
                const insertData = inserts.map(ins => ({
                    user_id: ins.user_id,
                    location_id: ins.location_id,
                    type: ins.type,
                    created_at: ins.created_at
                }));
                const { error: insErr } = await supabase
                    .from('logs')
                    .insert(insertData);
                if (insErr) throw insErr;
                console.log(`Successfully inserted ${inserts.length} checkout logs.`);
            }
            console.log('Cleanup completed successfully!');
        }

    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}

// Read CLI args to set dryRun
const args = process.argv.slice(2);
const dryRun = args.includes('--execute') ? false : true;
runCleanup(dryRun);
