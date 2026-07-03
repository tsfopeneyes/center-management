import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

supabase.from('notices').select('*').limit(1).then(res => {
    if (res.error) {
        console.error("Query Error:", res.error);
    } else if (res.data && res.data.length > 0) {
        console.log("Notices columns found:", Object.keys(res.data[0]));
    } else {
        // If empty table, query metadata using system columns
        console.log("Table empty. Querying system tables or trying basic insert simulation...");
        supabase.from('notices').insert([{ title: 'temp_test_check' }]).select().then(insRes => {
            console.log("Insert response keys:", insRes.data ? Object.keys(insRes.data[0]) : "No data");
            console.log("Insert response error:", insRes.error);
            // Delete temp row
            if (insRes.data && insRes.data[0]) {
                supabase.from('notices').delete().eq('id', insRes.data[0].id).then(() => console.log("Cleaned up temp row"));
            }
        });
    }
});
