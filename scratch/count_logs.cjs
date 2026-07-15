const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function countLogs() {
    const { count, error } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        console.error(error);
    } else {
        console.log('Total logs in "logs" table:', count);
    }
}
countLogs();
