const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testSync() {
    try {
        console.log('Calling legacy_login_sync for 신대영...');
        const { data, error } = await supabase.rpc('legacy_login_sync', {
            p_name: '신대영',
            p_hashed_pw: 'd7b6fab9aa91943de418ecbacefa4b276e82fbbb07bae1f7296775cc59a6f323'
        });

        if (error) {
            console.error('legacy_login_sync failed with error:', error);
        } else {
            console.log('legacy_login_sync result:', data);
        }
    } catch (err) {
        console.error(err);
    }
}
testSync();
