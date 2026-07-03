import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

async function testAuth() {
    console.log("Creating a dummy user via signUp...");
    const dummyEmail = `test_${Date.now()}@youth-access.app`;
    const dummyPw = hashPassword('1234');
    
    console.log(`Email: ${dummyEmail}`);
    console.log(`Password (hashed): ${dummyPw}`);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: dummyEmail,
        password: dummyPw
    });

    if (signUpError) {
        console.error("SignUp Error:", signUpError);
        return;
    }

    console.log("SignUp Success! User ID:", signUpData.user.id);

    console.log("\nAttempting to signIn immediately...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: dummyPw
    });

    if (signInError) {
        console.error("SignIn Error:", signInError);
    } else {
        console.log("SignIn Success! Session:", signInData.session?.access_token ? "Token exists" : "No token");
    }
}

testAuth();
