import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkResponses() {
    const { data, error } = await supabase
        .from('notice_responses')
        .select('*, users(name)')
        .eq('notice_id', 91);
        
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Responses found:", data.map(r => ({
            user_id: r.user_id,
            name: r.users?.name,
            status: r.status
        })));
    }
}

checkResponses();
