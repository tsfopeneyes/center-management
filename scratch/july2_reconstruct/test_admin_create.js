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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function testCreate() {
    console.log("Testing createUser with fresh UUID...");
    
    // Create random user
    const freshId = uuidv4();
    const { data: d1, error: e1 } = await supabase.auth.admin.createUser({
        id: freshId,
        email: `test_${Date.now()}@youth-access.app`,
        password: 'password123',
        email_confirm: true
    });
    
    console.log("Fresh user result:", d1?.user?.id, e1?.message);

    console.log("\nFetching one id from public.users to try...");
    const { data: u } = await supabase.from('users').select('id, name').limit(1);
    console.log("Public User ID:", u[0].id);

    // Try creating this specific user again
    const { data: d2, error: e2 } = await supabase.auth.admin.createUser({
        id: u[0].id,
        email: `${u[0].id}@youth-access.app`,
        password: 'password123',
        email_confirm: true
    });
    
    console.log("Linked user result:", d2?.user?.id, e2?.message);
}

testCreate();
