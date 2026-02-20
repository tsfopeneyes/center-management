
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProgramDate() {
    const { data, error } = await supabase
        .from('notices')
        .select('id, title, program_date')
        .not('program_date', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Program Dates:', JSON.stringify(data, null, 2));
    }
}

checkProgramDate();
