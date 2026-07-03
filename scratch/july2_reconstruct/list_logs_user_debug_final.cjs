const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
    const { data: logs } = await supabase.from('logs').select('*, locations(name)')
        .eq('user_id', '4601df9b-26a4-427a-83be-8c1a962d5347')
        .gte('created_at', '2026-02-20T00:00:00+09:00')
        .order('created_at');

    if (!logs || logs.length === 0) { console.log('No logs found'); return; }
    console.log(`Total logs for 정은교: ${logs.length}`);
    logs.forEach(l => {
        console.log(`${l.created_at} | ${l.type} | ${l.locations ? l.locations.name : 'Unknown'}`);
    });
}
run();
