const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUser() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('name', '신대영')
            .single();

        if (error) throw error;
        console.log('User data for 신대영:', data);
    } catch (err) {
        console.error('Error:', err);
    }
}
checkUser();
