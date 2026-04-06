import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    // There isn't a direct RPC to list tables with anon key usually, but let's try a few known historical tables.
    const tables = [
        'posts', 'post_likes', 'post_comments', 'community', 'community_posts', 'community_likes', 'guest_posts', 'guest_comments'
    ];
    
    for (const t of tables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
             if (error.message.includes('Could not find the table')) {
                 // doesn't exist
             } else {
                 console.log(`Table ${t} access error: ${error.message}`);
             }
        } else {
             console.log(`TABLE EXISTS: ${t}`);
             const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
             console.log(` -> Row count: ${count}`);
        }
    }
}

main();
