const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectRpc() {
    try {
        const { data, error } = await supabase.rpc('get_login_candidates', { p_name: '신대영' });
        console.log('Candidates for 신대영:', data, error?.message);

        // Let's query the definition of legacy_login_sync if we can via SQL or similar RPC?
        // Wait, is there any RPC we can use to query database functions?
        // Usually, there isn't unless we created one.
        // But we can check if there are other triggers in the database.
    } catch (err) {
        console.error(err);
    }
}
inspectRpc();
