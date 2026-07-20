import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findGuests() {
    try {
        console.log("Fetching guests...");
        // 1. Get all guest users
        const { data: guests, error: guestsError } = await supabase
            .from('users')
            .select('id, name, school, phone, created_at')
            .or("user_group.eq.게스트,name.ilike.%\\(guest\\)");

        if (guestsError) throw guestsError;
        console.log(`Found ${guests?.length || 0} guest users.`);

        if (!guests || guests.length === 0) return;

        const guestIds = guests.map(g => g.id);

        // 2. Fetch check-in logs for these guest IDs
        // Usually, check-in logs might have type = 'CHECK_IN' or just entry logs. Let's fetch all logs for these users.
        const { data: logs, error: logsError } = await supabase
            .from('logs')
            .select('id, user_id, created_at, type')
            .in('user_id', guestIds);

        if (logsError) throw logsError;

        // Group logs by user_id
        const userVisits = {};
        logs?.forEach(log => {
            // If the system logs check-in/check-out, let's treat each entry or CHECK_IN as a visit.
            // Let's filter by type if applicable, or count distinct days/sessions.
            // Let's print all types to understand what types exist.
            if (!userVisits[log.user_id]) {
                userVisits[log.user_id] = [];
            }
            userVisits[log.user_id].push(log);
        });

        console.log("\n--- All Guests and their visits ---");
        guests.forEach(guest => {
            const visits = userVisits[guest.id] || [];
            const uniqueVisitDays = new Set(visits.map(v => new Date(v.created_at).toLocaleDateString()));
            console.log(`- ${guest.name} (${guest.school}): ${uniqueVisitDays.size} visit days, phone: ${guest.phone}`);
        });

        console.log("\n--- Guests with 2 or more visits ---");
        let foundAny = false;
        guests.forEach(guest => {
            const visits = userVisits[guest.id] || [];
            const uniqueVisitDays = new Set(visits.map(v => new Date(v.created_at).toLocaleDateString()));
            
            if (uniqueVisitDays.size >= 2) {
                foundAny = true;
                console.log(`\nName: ${guest.name}`);
                console.log(`School: ${guest.school}`);
                console.log(`Phone: ${guest.phone}`);
                console.log(`Registered At: ${new Date(guest.created_at).toLocaleString()}`);
                console.log(`Total Logs: ${visits.length}`);
                console.log(`Unique Visit Days (${uniqueVisitDays.size} days):`);
                Array.from(uniqueVisitDays).forEach(day => {
                    const logsOnDay = visits.filter(v => new Date(v.created_at).toLocaleDateString() === day);
                    const logTimesStr = logsOnDay.map(v => new Date(v.created_at).toLocaleTimeString()).join(', ');
                    console.log(`  - ${day} (Times: ${logTimesStr})`);
                });
            }
        });

        if (!foundAny) {
            console.log("No guests with 2 or more visits found.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

findGuests();
