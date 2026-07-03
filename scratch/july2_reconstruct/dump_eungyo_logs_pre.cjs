const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: logs } = await supabase.from('logs').select('*, locations(name)')
        .eq('user_id', '4601df9b-26a4-427a-83be-8c1a962d5347')
        .lt('created_at', '2026-02-19T15:00:00Z') // Before Feb 20 00:00 KST
        .order('created_at', { ascending: false })
        .limit(5);

    let output = `--- Logs for 정은교 BEFORE Feb 20 ---\n`;
    if (logs) {
        logs.forEach(l => {
            const d = new Date(l.created_at);
            const loc = l.locations ? l.locations.name : 'Unknown';
            output += `${l.created_at} | KST: ${d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | ${l.type} | ${loc}\n`;
        });
    }

    fs.writeFileSync('debug_output_pre.txt', output);
}
run();
