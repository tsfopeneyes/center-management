import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsers() {
    console.log("Fetching first 3 users from public.users...");
    
    // Using limit to get any 3 users to see the structure of their 'password'
    const { data: users, error } = await supabase
        .from('users')
        .select('name, password, phone_back4')
        .limit(3);
        
    console.log("Error:", error);
    
    if (users) {
        users.forEach(u => {
            console.log(`User: ${u.name}, PW_Length: ${u.password ? u.password.length : 'null'}, PW_Value: ${u.password?.substring(0, 10)}..., Phone4: ${u.phone_back4}`);
        });
    }

    console.log("\nFetching specific student '이학생'...");
    const { data: student } = await supabase
        .from('users')
        .select('name, password')
        .ilike('name', '이학생');
    
    console.log("Student:", student);
}

checkUsers();
