import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkIlike() {
    console.log("Checking direct ILIKE query with substring 'dmi'...");
    const { data: matchSub } = await supabase.from('users').select('name').ilike('name', '%dmi%');
    console.log("With explicit %dmi% wildcards:", matchSub?.length, "rows");

    const { data: matchNoWild } = await supabase.from('users').select('name').ilike('name', 'dmi');
    console.log("With just 'dmi' (no wildcards):", matchNoWild?.length, "rows");

    // Also let's list the first 5 names in DB to see their format
    const { data: users } = await supabase.from('users').select('name').limit(5);
    console.log("Sample names in DB:", users?.map(u => `'${u.name}'`));
}

checkIlike();
