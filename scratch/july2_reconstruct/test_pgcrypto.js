import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://erecqalsxoxrufggvmcc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWNxYWxzeG94cnVmZ2d2bWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE5ODksImV4cCI6MjA4MzkzNzk4OX0.D9nwOIpXAH4QeN1k95drZx11NFmrl68SattEYPlXJ8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPgcrypto() {
    console.log("Starting pgcrypto compat check...");
    
    // Check if we can just test the fallback logic simulating legacy_login_sync behavior
    // Actually we can't run SQL crypt() here natively, we must rely on our assumption.
    // Let's print out what hashedPw is for "1234" vs what is expected.
    import('crypto').then(crypto => {
        const hash = crypto.createHash('sha256').update('1234').digest('hex');
        console.log("JS 1234 hash:", hash);
        console.log("Length:", hash.length);
    });
}
checkPgcrypto();
