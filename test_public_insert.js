import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            envVars[match[1].trim()] = match[2].trim();
        }
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testInsert() {
    const freshId = uuidv4();
    console.log("Testing insert into public.users with ID:", freshId);

    const { data: d1, error: e1 } = await supabase.from('users').insert([{
        id: freshId,
        name: `test_${Date.now()}`,
        password: 'password123',
        phone_back4: '1234'
    }]);

    console.log("Insert result:", e1?.message || "Success");
    
    // We expect this to either succeed (meaning the trigger successfully inserted into auth.users without issue)
    // OR fail with a specific Postgres error like "duplicate key violates constraint auth_identities_pkey" etc.

    // Let's delete it right away to stay clean
    await supabase.from('users').delete().eq('id', freshId);
    
    // Now let's try calling our legacy_login_sync RPC manually for the admin!
    console.log("\nAttempting to call legacy_login_sync RPC directly:");
    const { data: u } = await supabase.from('users').select('name, password').limit(1);
    
    // Call the RPC that acts as a wrapper to update auth.users
    const { data: d2, error: e2 } = await supabase.rpc('legacy_login_sync', {
        p_name: u[0].name,
        p_hashed_pw: u[0].password
    });
    console.log("RPC sync result:", d2, e2?.message);
}

testInsert();
