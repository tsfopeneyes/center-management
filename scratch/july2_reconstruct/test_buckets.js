import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read env variables from .env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0) env[key.trim()] = vals.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkBuckets() {
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
            console.error('Error listing buckets:', error);
        } else {
            console.log('Available buckets:');
            data.forEach(b => console.log('-', b.name, b.public ? '(Public)' : '(Private)'));
        }
    } catch (e) {
        console.error('Crash:', e);
    }
}
checkBuckets();
