const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectResponses() {
    try {
        const { data, error } = await supabase.from('notice_responses').select('*').limit(1);
        if (error) throw error;
        console.log('notice_responses columns:', Object.keys(data?.[0] || {}));
        console.log('notice_responses sample data:', data?.[0]);
    } catch (err) {
        console.error('Error:', err);
    }
}
inspectResponses();
