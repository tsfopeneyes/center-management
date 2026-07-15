const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectNotices() {
    try {
        const { data, error } = await supabase.from('notices').select('*').eq('id', 86).single();
        if (error) throw error;
        console.log('Notice columns:', Object.keys(data));
        console.log('Notice data:', data);

        // Let's test the exact query from PublicProgramDetail
        const { data: qData, error: qError } = await supabase
            .from('notices')
            .select('*, host:users(id, name, profile_image_url, school, role)')
            .eq('id', 86)
            .single();
        
        if (qError) {
            console.error('\nExact query failed with error:');
            console.error(qError);
        } else {
            console.log('\nExact query succeeded!', qData);
        }

    } catch (err) {
        console.error('Error:', err);
    }
}
inspectNotices();
