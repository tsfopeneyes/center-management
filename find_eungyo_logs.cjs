const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
    const { data: users } = await supabase.from('users').select('*').eq('name', '정은교');
    if (!users || users.length === 0) {
        console.log('User not found by name');
        return;
    }

    const user = users[0];
    console.log(`User found: ${user.name} (ID: ${user.id}, Group: ${user.user_group})`);

    const { data: logs } = await supabase.from('logs').select('*, locations(name)')
        .eq('user_id', user.id)
        .gte('created_at', '2026-02-19T15:00:00Z') // Feb 20 00:00 KST
        .lte('created_at', '2026-02-21T15:00:00Z')
        .order('created_at');

    if (!logs || logs.length === 0) {
        console.log('No logs found for this ID');
        return;
    }

    console.log(`Total logs: ${logs.length}`);
    logs.forEach(l => {
        const d = new Date(l.created_at);
        console.log(`${l.created_at} | KST: ${d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | ${l.type} | ${l.locations ? l.locations.name : 'Unknown'}`);
    });
}
run();
