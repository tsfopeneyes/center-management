import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUserTerms() {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, school, terms_agreed')
        .ilike('name', '%조시현%');
        
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Users found:", data);
    }
}

checkUserTerms();
