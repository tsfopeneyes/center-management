import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching guest_posts...");
    const { data } = await supabase.from('guest_posts').select('*').limit(1);
    console.log(JSON.stringify(data[0] || "Empty table", null, 2));
}

main();
