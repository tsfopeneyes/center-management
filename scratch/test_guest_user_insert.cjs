const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
    try {
        const guestId = '00000000-0000-0000-0000-' + Math.floor(100000000000 + Math.random() * 900000000000);
        console.log('Attempting to insert guest user with ID:', guestId);
        
        const { data: user, error: userErr } = await supabase
            .from('users')
            .insert({
                id: guestId,
                name: 'Test Guest',
                school: 'Test High School',
                phone: '010-1234-5678',
                phone_back4: '5678',
                user_group: '게스트',
                role: 'student'
            })
            .select()
            .single();

        if (userErr) {
            console.error('User insert failed:', userErr.message);
            return;
        }

        console.log('User insert succeeded! Now attempting notice_responses insert...');

        const { data: response, error: respErr } = await supabase
            .from('notice_responses')
            .insert({
                notice_id: 86, // DINNER CHURCH
                user_id: guestId,
                status: 'JOIN',
                is_attended: false
            })
            .select();

        if (respErr) {
            console.error('Notice response insert failed:', respErr.message);
        } else {
            console.log('Notice response insert succeeded! Result:', response);
            
            // Clean up response
            const { error: delRespErr } = await supabase.from('notice_responses').delete().eq('user_id', guestId);
            console.log('Response cleanup:', delRespErr ? delRespErr.message : 'Success');
        }

        // Clean up user
        const { error: delUserErr } = await supabase.from('users').delete().eq('id', guestId);
        console.log('User cleanup:', delUserErr ? delUserErr.message : 'Success');

    } catch (err) {
        console.error('Error:', err);
    }
}
testInsert();
