import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: settings, error: sErr } = await supabase.from('global_settings').select('*');
    console.log("Global Settings Error:", sErr);
    console.log("Global Settings Data:", settings);

    const { data: locs, error: lErr } = await supabase.from('locations').select('*, location_groups(*)');
    console.log("Locations Error:", lErr);
    console.log("Locations Data:", locs);
}

check();
