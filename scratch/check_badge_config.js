import { supabase } from '../src/supabaseClient.js';

async function checkConfig() {
    const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('category', 'SYSTEM')
        .eq('title', 'BADGE_SYSTEM_CONFIG');
    
    console.log('Data:', data);
    console.log('Error:', error);
}

checkConfig();
