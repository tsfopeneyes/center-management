import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSettings() {
    const { data: settings, error } = await supabase
        .from('global_settings')
        .select('*');
        
    if (error) {
        console.error("Error global_settings:", error.message);
        return;
    }
    
    console.log("Global Settings:", settings);
}

checkSettings();
