const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function dumpRpc() {
    try {
        console.log('Querying legacy_login_sync source code...');
        const sql = `
            SELECT pg_get_functiondef(p.oid) as definition
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'legacy_login_sync';
        `;
        const { data, error } = await supabase.rpc('exec_sql', { sql });
        if (error) throw error;
        console.log('Definition:\n', data[0]?.definition || 'Not found');
    } catch (err) {
        console.error('Error:', err);
    }
}
dumpRpc();
