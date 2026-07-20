import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/david/.gemini/antigravity/scratch/center-management-main/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const sql = `
        ALTER TABLE public.coffee_chats ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE public.coffee_chats ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `;
    console.log("Running Alter Table SQL via exec_sql RPC...");
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error("RPC exec_sql failed, trying key 'sql'...", error);
        const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql });
        if (error2) {
            console.error("Both RPCs failed:", error2);
        } else {
            console.log("Alter table success (sql)! Result:", data2);
        }
    } else {
        console.log("Alter table success (sql_query)! Result:", data);
    }
}
run();
