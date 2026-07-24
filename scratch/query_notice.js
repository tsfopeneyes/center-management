import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkNotice() {
    const { data, error } = await supabase
        .from('notices')
        .select('*')
        .ilike('title', '%test%');
        
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Notices found:", data.map(n => ({
            id: n.id,
            title: n.title,
            program_date: n.program_date,
            program_time: n.program_time,
            program_duration: n.program_duration,
            enable_post_program_button: n.enable_post_program_button,
            post_program_button_trigger: n.post_program_button_trigger,
            post_program_button_name: n.post_program_button_name,
            guest_properties: n.guest_properties
        })));
    }
}

checkNotice();
