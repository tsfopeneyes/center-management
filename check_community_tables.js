import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching community related tables...");
    
    const tablesToCheck = ['posts', 'community_posts', 'likes', 'post_likes', 'guest_post_likes'];
    
    for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            console.log(`Table '${table}' error:`, error.message);
        } else {
            console.log(`Table '${table}' EXISTS!`);
            // Check columns
            const { data } = await supabase.from(table).select('*').limit(1);
            console.log(`Columns for ${table}:`, data.length > 0 ? Object.keys(data[0]) : "No rows");
        }
    }
}

main();
