import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching a response row to check schema...");
    const { data, error } = await supabase.from('notice_responses').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Fields in notice_responses table:", Object.keys(data[0] || {}));
    }
}
run();
