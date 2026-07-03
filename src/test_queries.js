import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueries() {
    console.log('Testing schools...');
    const q1 = await supabase.from('schools').select('*').limit(1);
    console.log('Schools:', q1.error || 'OK');

    console.log('Testing rentals...');
    const q2 = await supabase.from('rentals').select('*, schools(name, region)').limit(1);
    console.log('Rentals:', q2.error || 'OK');

    console.log('Testing rental_bookings...');
    const q3 = await supabase
        .from('rental_bookings')
        .select(`
            *,
            profiles ( name, phone, school, grade ),
            rentals ( name, school_id, schools ( name, region ) )
        `)
        .limit(1);
    console.log('Rental Bookings:', q3.error || 'OK');
}

testQueries();
