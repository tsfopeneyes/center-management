const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function dumpRecentLogs() {
    try {
        console.log('Fetching recent school_logs (created_at >= 2026-07-08)...');
        const { data: logs, error: logsErr } = await supabase
            .from('school_logs')
            .select('*, users(name)')
            .gte('created_at', '2026-07-08T00:00:00Z')
            .order('created_at', { ascending: true });

        if (logsErr) throw logsErr;

        console.log(`Found ${logs.length} logs:`);
        logs.forEach(log => {
            const userName = log.users ? log.users.name : 'Unknown';
            const kstTime = new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            console.log(`- [${kstTime}] [${userName}] Type: ${log.type}, Location: ${log.location_id}, Duration: ${log.duration}, Remarks: ${log.remarks}`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

dumpRecentLogs();
