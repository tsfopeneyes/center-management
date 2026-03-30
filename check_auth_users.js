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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function checkAuthUsers() {
    console.log("Listing users in auth.users via Admin API...");
    const { data: usersData, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
        console.error("List users error:", error);
        return;
    }
    
    console.log(`Found ${usersData.users.length} users in auth.users.`);
    if (usersData.users.length > 0) {
        console.log("Sample users:");
        usersData.users.slice(0, 3).forEach(u => console.log(`ID: ${u.id}, Email: ${u.email}, Created: ${u.created_at}`));
    }
}

checkAuthUsers();
