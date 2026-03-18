const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: logs } = await supabase.from('logs').select('*, users(name)')
        .gte('created_at', '2026-02-19T23:00:00Z') // Feb 20 08:00 KST
        .lte('created_at', '2026-02-20T00:30:00Z') // Feb 20 09:30 KST
        .order('created_at');

    let output = `--- Morning Logs (8:00 - 9:30 KST) ---\n`;
    if (logs) {
        logs.forEach(l => {
            const d = new Date(l.created_at);
            output += `${l.created_at} | KST: ${d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | ${l.users?.name} | ${l.type}\n`;
        });
    }

    fs.writeFileSync('morning_logs.txt', output);
}
run();
