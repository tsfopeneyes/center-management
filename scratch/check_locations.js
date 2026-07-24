import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkLocations() {
    const { data: locations, error } = await supabase
        .from('locations')
        .select('*');
        
    if (error) {
        console.error("Error locations:", error.message);
        return;
    }
    
    console.log("Locations:", locations);
    
    const { data: groups, error: error2 } = await supabase
        .from('location_groups')
        .select('*');
        
    if (error2) {
        console.error("Error groups:", error2.message);
        return;
    }
    
    console.log("Location Groups:", groups);
}

checkLocations();
