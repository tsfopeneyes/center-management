import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRpc() {
    console.log("Checking direct ILIKE query on users table...");
    // Try doing direct query first using anon key. If RLS is enabled and stops anon, this should fail.
    const { data: directData, error: directError } = await supabase
        .from('users')
        .select('*')
        .ilike('name', 'admin');
    console.log("Direct Query error:", directError);
    console.log("Direct Query data length:", directData?.length);

    console.log("\nChecking RPC 'get_login_candidates' for 'admin'...");
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_login_candidates', { p_name: 'admin' });
    
    fs.writeFileSync('debug_out.json', JSON.stringify({ rpcData, rpcError }, null, 2));
    console.log("Wrote to debug_out.json");
}

checkRpc();
