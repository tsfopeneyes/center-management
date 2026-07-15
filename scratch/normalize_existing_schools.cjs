const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const normalizeSchoolName = (school) => {
    if (!school) return '';
    const trimmed = school.trim();
    if (trimmed.endsWith('고등학교') || trimmed.endsWith('중학교') || trimmed.endsWith('초등학교')) {
        return trimmed;
    }
    if (trimmed.endsWith('외고')) {
        return trimmed.slice(0, -2) + '외국어고등학교';
    }
    if (trimmed.endsWith('여고')) {
        return trimmed.slice(0, -2) + '여자고등학교';
    }
    if (trimmed.endsWith('고')) {
        return trimmed.slice(0, -1) + '고등학교';
    }
    if (trimmed.endsWith('여중')) {
        return trimmed.slice(0, -2) + '여자중학교';
    }
    if (trimmed.endsWith('중')) {
        return trimmed.slice(0, -1) + '중학교';
    }
    if (trimmed.endsWith('초')) {
        return trimmed.slice(0, -1) + '초등학교';
    }
    return trimmed;
};

async function migrate() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, name, school');
    
    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log(`Fetched ${users.length} users.`);

    let updateCount = 0;
    for (const user of users) {
        if (!user.school) continue;
        const normalized = normalizeSchoolName(user.school);
        if (normalized !== user.school) {
            console.log(`Updating user: ${user.name} (${user.school} -> ${normalized})`);
            const { error: updateError } = await supabase
                .from('users')
                .update({ school: normalized })
                .eq('id', user.id);
            if (updateError) {
                console.error(`Failed to update user ${user.name}:`, updateError);
            } else {
                updateCount++;
            }
        }
    }
    console.log(`Successfully updated ${updateCount} users' school names!`);
}

migrate();
