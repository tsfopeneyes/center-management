import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
    console.error('Could not find Supabase credentials in .env');
    process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function testInsert() {
    const headers = {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    // Get a real school
    const sRes = await fetch(url + '/rest/v1/schools?select=id&limit=1', { headers });
    const sData = await sRes.json();
    const school_id = sData[0].id;

    // Get two real users (author and staff)
    const uRes = await fetch(url + '/rest/v1/users?select=id,name&limit=2', { headers });
    const uData = await uRes.json();
    const author_id = uData[0].id;
    const staff_id = uData[1].id;

    console.log('Inserting with IDs:', { school_id, author_id, staff_id });

    // Test insert
    const iRes = await fetch(url + '/rest/v1/school_logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            school_id,
            author_id,
            date: '2026-02-23',
            time_range: '17:00~18:30',
            location: 'Test',
            participant_ids: [],
            facilitator_ids: [staff_id],
            content: 'Test content'
        })
    });

    const iData = await iRes.json();
    console.log('Result:', JSON.stringify(iData, null, 2));
}

testInsert().catch(console.error);
