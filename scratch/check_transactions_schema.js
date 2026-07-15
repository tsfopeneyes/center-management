import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Checking schema of hyphen_transactions...");
    // We can run exec_sql or get one row and output its keys, or check foreign key constraints.
    // Let's get one row if exists, or check the columns by requesting a non-existent column to trigger Postgres error with column list.
    const { data, error } = await supabase
        .from('hyphen_transactions')
        .select('admin_id')
        .limit(1);
        
    console.log("admin_id query result:", { data, error });
}
run();
