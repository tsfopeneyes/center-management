import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testAnonRead() {
    const { data, error } = await supabase.from('global_settings').select('*');
    console.log("Anon select global_settings error:", error);
    console.log("Anon select global_settings data count:", data ? data.length : 0);
    console.log("Data:", data);
}

testAnonRead();
