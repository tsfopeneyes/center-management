const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTodayAccessKST() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, name, school, role, user_group, preferences');
        
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    
    const targetDateStr = '2026-07-23';
    
    // Unified isAdminOrStaff logic
    const isAdminOrStaff = (user) => {
        if (!user) return false;
        return user.name === 'admin' ||
            user.user_group === '관리자' ||
            user.user_group === 'STAFF' ||
            user.role === 'admin' ||
            user.role === 'STAFF';
    };

    const studentLogins = [];

    users.forEach(u => {
        const lastLogin = u.preferences?.last_web_login_at;
        if (!lastLogin) return;
        
        // Parse time and convert to KST
        const dateObj = new Date(lastLogin);
        if (isNaN(dateObj.getTime())) return;
        
        // Get KST date string (YYYY-MM-DD)
        const options = { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('ko-KR', options);
        const parts = formatter.formatToParts(dateObj);
        
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const kstDateStr = `${year}-${month}-${day}`;
        
        const timeOptions = { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        const kstTimeStr = new Intl.DateTimeFormat('ko-KR', timeOptions).format(dateObj);

        if (kstDateStr === targetDateStr) {
            if (!isAdminOrStaff(u)) {
                studentLogins.push({
                    name: u.name,
                    school: u.school || '미지정',
                    user_group: u.user_group,
                    role: u.role,
                    last_web_login_at_utc: lastLogin,
                    last_web_login_at_kst: `${kstDateStr} ${kstTimeStr}`
                });
            }
        }
    });

    console.log(JSON.stringify(studentLogins, null, 2));
}

checkTodayAccessKST();
