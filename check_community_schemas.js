import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Checking columns of community_posts...");
    const { data: postsData } = await supabase.from('community_posts').select('*').limit(1);
    console.log("community_posts: ", postsData && postsData.length > 0 ? Object.keys(postsData[0]) : "No rows");

    console.log("Checking columns of community_likes...");
    // maybe no 'id' in likes table, let's just select *
    const { data: likesData, error } = await supabase.from('community_likes').select('*').limit(1);
    if(error) console.log(error);
    else console.log("community_likes: ", likesData && likesData.length > 0 ? Object.keys(likesData[0]) : "No rows");
}

main();
