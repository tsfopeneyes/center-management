import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('Deleting unused duplicate...');
    const { data, error } = await supabase.from('schools').delete().eq('id', '17eba817-d415-42e9-9cdf-2bba86cb01fc');
    if (error) console.error(error);
    else console.log('Deleted successfully.');
}
run();
