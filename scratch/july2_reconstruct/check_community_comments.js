import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: commentsData, error } = await supabase.from('community_comments').select('*').limit(1);
    if(error) console.log(error);
    else console.log("community_comments: ", commentsData && commentsData.length > 0 ? Object.keys(commentsData[0]) : "No rows");
}

main();
