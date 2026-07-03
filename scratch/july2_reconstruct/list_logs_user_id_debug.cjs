const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
    const { data: logs } = await supabase.from('logs').select('*, locations(name)')
        .eq('user_id', '59211818-a316-4e96-a8c9-1d329d7aed8a')
        .order('created_at', { ascending: false })
        .limit(100);

    if (!logs || logs.length === 0) { console.log('No logs found'); return; }
    logs.forEach(l => {
        console.log(`${l.created_at} | ${l.type} | ${l.locations ? l.locations.name : 'null'}`);
    });
}
run();
