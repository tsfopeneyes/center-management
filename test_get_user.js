import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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

async function testFetch() {
    const { data: u } = await supabase.from('users').select('id, name').limit(1);
    const userId = u[0].id;
    console.log("Testing user:", userId);

    console.log("Trying admin.getUserById...");
    const { data: d1, error: e1 } = await supabase.auth.admin.getUserById(userId);
    console.log("Get User:", d1?.user?.id ? "Exists" : "Not Found", e1?.message);

    console.log("Trying admin.deleteUser...");
    const { data: d2, error: e2 } = await supabase.auth.admin.deleteUser(userId);
    console.log("Delete User:", d2 ? "Deleted" : "Failed", e2?.message);

    console.log("Trying createUser again...");
    const { data: d3, error: e3 } = await supabase.auth.admin.createUser({
        id: userId,
        email: `${userId}@youth-access.app`,
        password: 'password123',
        email_confirm: true
    });
    console.log("Create Result:", d3?.user?.id, e3?.message);
}

testFetch();
