import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('Querying for 미림...');
    const { data, error } = await supabase.from('schools').select('id, name').like('name', '%미림%');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));

    const { data: users, error: userError } = await supabase.from('users').select('id, name, school').like('school', '%미림%');
    if(userError) console.error(userError);
    else console.log(JSON.stringify(users, null, 2));
}
run();
