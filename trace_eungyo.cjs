const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: users } = await supabase.from('users').select('*').eq('name', '정은교');
    if (!users || users.length === 0) { console.log('User not found'); return; }
    const uid = users[0].id;

    const { data: logs } = await supabase.from('logs').select('*')
        .eq('user_id', uid)
        .gte('created_at', '2026-02-19T00:00:00Z')
        .lte('created_at', '2026-02-21T00:00:00Z')
        .order('created_at');

    let output = `User: ${users[0].name} (${uid})\n`;
    if (logs) {
        logs.forEach(l => {
            const d = new Date(l.created_at);
            output += `${l.created_at} | KST: ${d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | ${l.type} | ${l.location_id}\n`;
        });
    }

    fs.writeFileSync('output_eungyo.txt', output);
}
run();
