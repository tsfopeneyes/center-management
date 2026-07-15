import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const sql = `
        ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS host_ids UUID[] DEFAULT '{}';
        UPDATE public.notices SET host_ids = ARRAY[host_id] WHERE host_id IS NOT NULL;
        NOTIFY pgrst, 'reload schema';
    `;
    
    console.log("Calling RPC exec_sql...");
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }); // Try sql_query or sql
    
    if (error) {
        console.error("RPC Error:", error);
        console.log("Trying arg name 'sql'...");
        const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql });
        if (error2) {
            console.error("RPC with 'sql' also failed:", error2);
        } else {
            console.log("RPC Success with 'sql'! Result:", data2);
        }
    } else {
        console.log("RPC Success! Result:", data);
    }
}
run();
