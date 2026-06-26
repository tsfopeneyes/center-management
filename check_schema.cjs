const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Missing env vars');
    process.exit(1);
}

const CryptoJS = require('crypto-js');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', '강하민');
    if (error) {
        console.error(error);
    } else {
        console.log('User 강하민:', users);
        if (users && users.length > 0) {
            const rawPw = '4522';
            const hashedLocal = CryptoJS.SHA256(rawPw).toString(CryptoJS.enc.Hex);
            console.log('SHA256 of "4522":', hashedLocal);
        }
    }
}

check();
