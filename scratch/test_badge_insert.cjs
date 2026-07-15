const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    const contentJson = JSON.stringify({ enabled: false });
    const { data, error } = await supabase
        .from('notices')
        .insert([{
            title: 'BADGE_SYSTEM_CONFIG',
            content: contentJson,
            category: 'SYSTEM',
            is_recruiting: false,
            is_sticky: false
        }]);
    
    console.log('Insert Result Data:', data);
    console.log('Insert Result Error:', error);
}

testInsert();
