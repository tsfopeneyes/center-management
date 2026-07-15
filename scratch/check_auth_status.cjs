const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAuth() {
    try {
        console.log('Querying login candidates for 조은결...');
        const { data: candidates1 } = await supabase.rpc('get_login_candidates', { p_name: '조은결' });
        console.log('Candidates for 조은결:', candidates1);

        console.log('\nQuerying login candidates for 조서현...');
        const { data: candidates2 } = await supabase.rpc('get_login_candidates', { p_name: '조서현' });
        console.log('Candidates for 조서현:', candidates2);

    } catch (err) {
        console.error(err);
    }
}
checkAuth();
