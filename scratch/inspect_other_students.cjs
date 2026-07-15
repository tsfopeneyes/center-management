const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectStudents() {
    try {
        console.log('Searching for 은결 in users...');
        const { data: eungyeol, error: err1 } = await supabase
            .from('users')
            .select('*')
            .ilike('name', '%은결%');
        console.log('Result for 은결:', eungyeol, err1?.message);

        console.log('\nSearching for 조서현 in users...');
        const { data: seohyun, error: err2 } = await supabase
            .from('users')
            .select('*')
            .ilike('name', '%조서현%');
        console.log('Result for 조서현:', seohyun, err2?.message);

    } catch (err) {
        console.error(err);
    }
}
inspectStudents();
