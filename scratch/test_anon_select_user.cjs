const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testSelect() {
    try {
        console.log('Attempting to query user 신대영 with password check as anon...');
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', '8c9b45a0-792f-4577-9cea-47e09891e7bb')
            .eq('password', 'd7b6fab9aa91943de418ecbacefa4b276e82fbbb07bae1f7296775cc59a6f323')
            .maybeSingle();

        if (error) {
            console.error('Query failed with error:', error);
        } else {
            console.log('Query result:', data);
        }
    } catch (err) {
        console.error(err);
    }
}
testSelect();
