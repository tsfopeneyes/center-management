const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkNotices() {
    try {
        console.log('Querying first 5 notices...');
        const { data, error } = await supabase
            .from('notices')
            .select('id, title, category')
            .limit(5);

        if (error) throw error;

        console.log('Notice ID samples:');
        data.forEach(n => {
            console.log(`- ID: ${n.id} (${typeof n.id}), Title: ${n.title}, Category: ${n.category}`);
        });

        // Let's search for ID 86
        console.log('\nSearching for notice ID 86 (as number)...');
        const { data: numData, error: numError } = await supabase
            .from('notices')
            .select('id, title')
            .eq('id', 86);
        
        console.log('Search with numeric 86 result:', numData, numError?.message);

        console.log('\nSearching for notice ID "86" (as string)...');
        const { data: strData, error: strError } = await supabase
            .from('notices')
            .select('id, title')
            .eq('id', '86');

        console.log('Search with string "86" result:', strData, strError?.message);

    } catch (err) {
        console.error('Error:', err);
    }
}

checkNotices();
