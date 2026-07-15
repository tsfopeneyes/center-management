import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching latest transactions from hyphen_transactions...");
    const { data, error } = await supabase
        .from('hyphen_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Latest transactions:", data);
    }
}
run();
