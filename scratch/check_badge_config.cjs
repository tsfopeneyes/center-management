const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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
