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

async function testUpdatePK() {
    const oldId = uuidv4();
    const newId = uuidv4();
    
    console.log("Inserting old user...");
    await supabase.from('users').insert({
        id: oldId,
        name: 'test_pk_update',
        phone_back4: '1234'
    });

    console.log("Attempting to update PK...");
    const { data, error } = await supabase.from('users').update({ id: newId }).eq('id', oldId).select();
    console.log("Update result:", error ? error.message : "Success");
    
    // Clean up
    await supabase.from('users').delete().eq('id', newId);
    await supabase.from('users').delete().eq('id', oldId);
}

testUpdatePK();
