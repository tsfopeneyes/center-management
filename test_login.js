import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

async function testLogin(name, password) {
    console.log(`\nTesting login for: ${name}`);
    const hashedPw = hashPassword(password);
    console.log(`Hashed PW: ${hashedPw}`);

    console.log('--- 1. Testing get_login_candidates RPC ---');
    const { data: candidates, error: rpcError } = await supabase.rpc('get_login_candidates', { p_name: name });
    
    if (rpcError) {
        console.error('RPC Error:', rpcError);
        return;
    }
    console.log('Candidates found:', candidates);

    if (!candidates || candidates.length === 0) {
        console.log('No candidates found! This implies the RPC is failing or name is not in DB.');
        return;
    }

    console.log('--- 2. Testing Auth Login ---');
    const email = candidates[0].email;
    console.log(`Attempting login with Email: ${email}`);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: hashedPw
    });

    if (authError) {
        console.error('Auth Error:', authError);
    } else {
        console.log('Auth Success! User ID:', authData.user.id);
    }
}

// Test with typical cases. Assuming admin or some user exists.
// By default we don't know EXACT user names, let's search for "관리자"
testLogin('관리자', '1234');
testLogin('admin', '1234');
