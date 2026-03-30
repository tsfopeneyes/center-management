import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const { data, error } = await supabase
        .from('store_orders')
        .select(`
            *,
            users (name, school, grade),
            hyphen_items (name, requires_approval)
        `)
        .eq('status', 'PENDING');
        
    if (error) {
        console.error("Error:", error.message, error.details, error.hint);
    } else {
        console.log("Success:", data);
    }
}

test();
