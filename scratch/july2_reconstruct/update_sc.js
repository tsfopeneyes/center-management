import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('d:\\coding\\ENTER\\.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUsers() {
    console.log('Fetching users...');
    let allUsers = [];
    let page = 0;
    while (true) {
        const { data: users, error } = await supabase.from('users').select('id, preferences').range(page * 1000, (page + 1) * 1000 - 1);
        if (error) {
            console.error('Error fetching users:', error);
            return;
        }
        if (!users || users.length === 0) break;
        allUsers = allUsers.concat(users);
        page++;
    }

    console.log(`Found ${allUsers.length} users. Updating...`);
    let successCount = 0;
    for (const user of allUsers) {
        const prefs = user.preferences || {};
        // Only update if it's not already true
        if (prefs.is_school_church !== true) {
            prefs.is_school_church = true;
            const { error } = await supabase.from('users').update({ preferences: prefs }).eq('id', user.id);
            if (error) {
                console.error(`Failed to update user ${user.id}`, error);
            } else {
                successCount++;
            }
        }
    }
    console.log(`Successfully updated ${successCount} users.`);
}

updateUsers();
