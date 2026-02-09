
import { supabase } from './src/supabaseClient.js';

async function checkSchema() {
    const { data, error } = await supabase.from('guest_posts').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Columns:', Object.keys(data[0] || {}));
    }
}

checkSchema();
