const { createClient } = require('@supabase/supabase-js');
const { startOfDay, endOfDay } = require('date-fns');
const fs = require('fs');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const date = new Date(2026, 1, 20); // Feb 20
    const start = startOfDay(date);
    const end = endOfDay(date);

    const { data: logs, error: lErr } = await supabase.from('logs').select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

    if (lErr) { fs.writeFileSync('debug_output.txt', `Logs Error: ${JSON.stringify(lErr)}`); return; }

    const { data: users } = await supabase.from('users').select('*');
    const { data: locations } = await supabase.from('locations').select('*');

    const userMap = new Map(users.map(u => [u.id, u]));
    const locMap = new Map(locations.map(l => [l.id, l]));

    const targetName = '정은교';
    const targetUser = users.find(u => u.name === targetName);

    if (!targetUser) {
        fs.writeFileSync('debug_output.txt', `User ${targetName} not found`);
        return;
    }

    const myLogs = logs.filter(l => l.user_id === targetUser.id);

    let output = `--- Logs for ${targetName} (${targetUser.id}) ---\n`;
    myLogs.forEach(l => {
        const d = new Date(l.created_at);
        const loc = locMap.get(l.location_id);
        output += `${l.created_at} | KST: ${d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | ${l.type} | ${loc ? loc.name : 'Unknown'}\n`;
    });

    fs.writeFileSync('debug_output.txt', output);
}
run();
