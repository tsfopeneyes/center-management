import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: logsData, error: logsError } = await supabase.from('logs').select('*').limit(3);
    console.log("Logs sample error:", logsError);
    console.log("Logs sample:", logsData);
}
main();
