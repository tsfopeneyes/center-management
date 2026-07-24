const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function fullAudit() {
    console.log('=== Starting Full-Scale Audit across all DB tables ===');

    // 1. Fetch all users
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, name, school, created_at, preferences');
    
    if (uErr) {
        console.error('Error fetching users:', uErr);
        return;
    }

    console.log(`Total Users to Audit: ${users.length}`);

    // 2. Fetch activity timestamps across all tables
    const { data: responses } = await supabase.from('notice_responses').select('user_id, created_at');
    const { data: logs } = await supabase.from('logs').select('user_id, created_at');
    
    let posts = [];
    try {
        const { data: pData } = await supabase.from('posts').select('user_id, created_at');
        if (pData) posts = pData;
    } catch (e) {}

    let comments = [];
    try {
        const { data: cData } = await supabase.from('comments').select('user_id, created_at');
        if (cData) comments = cData;
    } catch (e) {}

    // Map user_id -> max timestamp
    const userLatestMap = {};

    const recordActivity = (userId, timeStr) => {
        if (!userId || !timeStr) return;
        const time = new Date(timeStr).getTime();
        if (isNaN(time)) return;
        if (!userLatestMap[userId] || time > userLatestMap[userId]) {
            userLatestMap[userId] = time;
        }
    };

    (responses || []).forEach(r => recordActivity(r.user_id, r.created_at));
    (logs || []).forEach(l => recordActivity(l.user_id, l.created_at));
    (posts || []).forEach(p => recordActivity(p.user_id, p.created_at));
    (comments || []).forEach(c => recordActivity(c.user_id, c.created_at));

    let updatedCount = 0;
    const auditResults = [];

    for (const user of users) {
        const currentWebLogin = user.preferences?.last_web_login_at 
            ? new Date(user.preferences.last_web_login_at).getTime() 
            : 0;
        
        const maxActivity = userLatestMap[user.id] || (user.created_at ? new Date(user.created_at).getTime() : 0);

        if (maxActivity > currentWebLogin || !user.preferences?.last_web_login_at) {
            const bestTimeIso = new Date(maxActivity).toISOString();
            const newPref = { ...(user.preferences || {}), last_web_login_at: bestTimeIso };

            const { error } = await supabase
                .from('users')
                .update({ preferences: newPref })
                .eq('id', user.id);

            if (!error) {
                updatedCount++;
                auditResults.push({
                    id: user.id,
                    name: user.name,
                    school: user.school,
                    formattedTime: new Date(maxActivity).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                });
            } else {
                console.error(`Failed to update ${user.name}:`, error);
            }
        }
    }

    console.log(`\n=== Full Audit Completed! Updated ${updatedCount} / ${users.length} users ===\n`);
    
    // Print Jang Hyunwoo specifically
    const jangHyunWoo = auditResults.find(u => u.name && u.name.includes('장현우'));
    console.log('Jang Hyunwoo Result:', jangHyunWoo);

    console.log('\nTop 20 Sample Updated Users:');
    console.table(auditResults.slice(0, 20));
}

fullAudit();
