import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTodayAccess() {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, school, role, user_group, preferences');
        
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    
    // Today's date in KST: 2026-07-23 (since local time is 16:47 KST, UTC date is also 2026-07-23)
    const targetDateStr = '2026-07-23';
    
    const accessedUsers = data.filter(u => {
        const lastLogin = u.preferences?.last_web_login_at;
        if (!lastLogin) return false;
        
        // Convert to local date string or check if it starts with targetDateStr in UTC/Local
        // Let's print out all users logins to see if they are KST
        return lastLogin.startsWith(targetDateStr);
    });
    
    console.log("Total users found in database:", data.length);
    console.log("Users logged in today (UTC/KST match):", accessedUsers.map(u => ({
        name: u.name,
        school: u.school,
        role: u.role,
        user_group: u.user_group,
        last_web_login_at: u.preferences.last_web_login_at
    })));
}

checkTodayAccess();
