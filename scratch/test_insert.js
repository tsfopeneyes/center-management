import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Testing insert into hyphen_transactions...");
    
    // Get a valid user_id first to avoid foreign key violations
    const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
    if (userErr || !users || users.length === 0) {
        console.error("Could not find any user to test:", userErr);
        return;
    }
    
    const testUserId = users[0].id;
    console.log(`Using test user ID: ${testUserId}`);
    
    const descMatch = `[오픈 프로그램 참여] 테스트 프로그램 (2026-07-03)`;
    
    const { data, error } = await supabase
        .from('hyphen_transactions')
        .insert([{
            user_id: testUserId,
            amount: 30,
            transaction_type: 'EARN',
            source_description: descMatch,
            admin_id: null // Try inserting with null admin_id first
        }])
        .select();
        
    console.log("Insert with null admin_id result:", { data, error });
    
    if (!error) {
        // Clean up
        const { error: delErr } = await supabase
            .from('hyphen_transactions')
            .delete()
            .eq('id', data[0].id);
        console.log("Cleanup result:", delErr);
    }
    
    // Now try inserting with 'admin' as admin_id
    const { data: data2, error: error2 } = await supabase
        .from('hyphen_transactions')
        .insert([{
            user_id: testUserId,
            amount: 30,
            transaction_type: 'EARN',
            source_description: descMatch + ' 2',
            admin_id: 'admin'
        }])
        .select();
        
    console.log("Insert with 'admin' admin_id result:", { data: data2, error: error2 });
    
    if (!error2) {
        // Clean up
        const { error: delErr2 } = await supabase
            .from('hyphen_transactions')
            .delete()
            .eq('id', data2[0].id);
        console.log("Cleanup 2 result:", delErr2);
    }
}
run();
