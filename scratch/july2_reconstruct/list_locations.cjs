const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: locs } = await supabase.from('locations').select('*');
    let output = 'ID | Name | GroupID\n';
    if (locs) {
        locs.forEach(l => {
            output += `${l.id} | ${l.name} | ${l.group_id}\n`;
        });
    }
    fs.writeFileSync('all_locations.txt', output);
}
run();
