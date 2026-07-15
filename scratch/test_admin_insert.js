import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Finding admin user...");
    const { data: admins, error: adminErr } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin')
        .limit(1);
        
    if (adminErr || !admins || admins.length === 0) {
        console.error("No admin user found or error:", adminErr);
        // Let's get all users to see if any have role=admin or what roles exist
        const { data: allUsers } = await supabase.from('users').select('id, name, role').limit(10);
        console.log("Latest users:", allUsers);
        return;
    }
    
    const admin = admins[0];
    console.log(`Found admin: ${admin.name} (ID: ${admin.id})`);
    
    // Get a student user to award points to
    const { data: students } = await supabase.from('users').select('id, name').neq('id', admin.id).limit(1);
    if (!students || students.length === 0) {
        console.error("No student user found");
        return;
    }
    
    const student = students[0];
    const descMatch = `[오픈 프로그램 참여] 테스트 프로그램 (2026-07-03)`;
    
    console.log(`Testing insert for student: ${student.name} with admin: ${admin.name}`);
    
    const { data: insertResult, error: insertErr } = await supabase
        .from('hyphen_transactions')
        .insert([{
            user_id: student.id,
            amount: 30,
            transaction_type: 'EARN',
            source_description: descMatch,
            admin_id: admin.id
        }])
        .select();
        
    console.log("Insert result:", { insertResult, insertErr });
    
    if (!insertErr && insertResult) {
        const txId = insertResult[0].id;
        console.log(`Successfully inserted transaction ID: ${txId}`);
        
        // Now try to select it
        const { data: selectResult, error: selectErr } = await supabase
            .from('hyphen_transactions')
            .select('*')
            .eq('id', txId);
            
        console.log("Select by ID result:", { selectResult, selectErr });
        
        // Try selecting by description
        const { data: selectDescResult, error: selectDescErr } = await supabase
            .from('hyphen_transactions')
            .select('user_id, users(id, name)')
            .eq('source_description', descMatch);
            
        console.log("Select by description result:", { selectDescResult, selectDescErr });
        
        // Clean up
        const { error: delErr } = await supabase
            .from('hyphen_transactions')
            .delete()
            .eq('id', txId);
        console.log("Cleanup result:", delErr);
    }
}
run();
