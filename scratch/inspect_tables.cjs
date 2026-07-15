const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectTables() {
    const { data: logsData } = await supabase.from('logs').select('*').limit(1);
    const { data: schoolLogsData } = await supabase.from('school_logs').select('*').limit(1);
    
    console.log('logs columns:', Object.keys(logsData?.[0] || {}));
    console.log('school_logs columns:', Object.keys(schoolLogsData?.[0] || {}));
}
inspectTables();
