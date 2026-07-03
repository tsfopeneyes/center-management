import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data, error } = await supabase
            .from('guest_posts')
            .select('*, users!guest_posts_user_id_fkey(name, school, user_group, profile_image_url), guest_post_likes(user_id)')
            .order('created_at', { ascending: false })
            .limit(1);
    
    fs.writeFileSync('error_log.json', JSON.stringify(error || data, null, 2), 'utf-8');
}

main();
