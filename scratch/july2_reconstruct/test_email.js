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

async function testEmail() {
    console.log("Testing createUser with generic email...");
    
    const { data: d1, error: e1 } = await supabase.auth.admin.createUser({
        email: `valid${Date.now()}@gmail.com`,
        password: 'password123',
        email_confirm: true
    });
    console.log("Generic email result:", e1?.message || "Success");

    console.log("Testing createUser with @youth-access.app email...");
    const { data: d2, error: e2 } = await supabase.auth.admin.createUser({
        email: `test${Date.now()}@youth-access.app`,
        password: 'password123',
        email_confirm: true
    });
    console.log("Youth-access email result:", e2?.message || "Success");
}

testEmail();
