import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkLogCount() {
    // 2026-07-22 KST starts at 2026-07-21T15:00:00Z and ends at 2026-07-22T15:00:00Z
    const { data, error } = await supabase
        .from('logs')
        .select('id, type, created_at, location_id')
        .gte('created_at', '2026-07-21T15:00:00Z')
        .lte('created_at', '2026-07-22T15:00:00Z');
        
    if (error) {
        console.error("Error logs:", error.message);
        return;
    }
    
    console.log("Total space logs on 2026-07-22 KST:", data.length);
    const types = data.reduce((acc, log) => {
        acc[log.type] = (acc[log.type] || 0) + 1;
        return acc;
    }, {});
    console.log("Types breakdown:", types);
    
    const locations = data.reduce((acc, log) => {
        const locId = log.location_id || 'unknown';
        acc[locId] = (acc[locId] || 0) + 1;
        return acc;
    }, {});
    console.log("Locations breakdown:", locations);
}

checkLogCount();
