const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log('Testing Supabase connection...');
    console.log('URL:', supabaseUrl);

    try {
        const { data, error } = await supabase.from('users').select('name').limit(1);

        if (error) {
            console.error('Connection error:', error.message);
            process.exit(1);
        }

        console.log('Connection successful! Found user:', data[0]?.name);
        process.exit(0);
    } catch (err) {
        console.error('Unexpected error:', err.message);
        process.exit(1);
    }
}

testConnection();
