import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching guest_posts with relations...");
    const { data, error } = await supabase
            .from('guest_posts')
            .select('*, users(name, school, user_group, profile_image_url), guest_post_likes(user_id)')
            .order('created_at', { ascending: false })
            .limit(1);
    
    if (error) {
        console.error("ERROR:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("SUCCESS:");
        console.log(JSON.stringify(data, null, 2));
    }
}

main();
