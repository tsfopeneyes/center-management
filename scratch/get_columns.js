import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);
        
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Keys of users table:", data.length > 0 ? Object.keys(data[0]) : "No users found");
        console.log("Full user object sample:", data[0]);
    }
}

checkColumns();
