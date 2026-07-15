const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env file manually
const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            envVars[match[1].trim()] = match[2].trim();
        }
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

if (!serviceRoleKey) {
    console.error("VITE_SUPABASE_SERVICE_ROLE_KEY is not set in .env!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function syncAllMissingUsers() {
    try {
        console.log("Fetching all users from public.users...");
        const { data: publicUsers, error: publicError } = await supabase
            .from('users')
            .select('id, name, phone, password, user_group, school');

        if (publicError) throw publicError;
        console.log(`Found ${publicUsers.length} total users in public.users.`);

        console.log("Fetching all users from auth.users...");
        let allAuthUsers = [];
        let page = 1;
        while (true) {
            const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers({
                page: page,
                perPage: 1000
            });
            if (authError) throw authError;
            if (!authUsers || authUsers.length === 0) break;
            allAuthUsers = allAuthUsers.concat(authUsers);
            if (authUsers.length < 1000) break;
            page++;
        }
        console.log(`Found ${allAuthUsers.length} users in auth.users.`);

        const authUserIds = new Set(allAuthUsers.map(u => u.id));
        const authEmails = new Set(allAuthUsers.map(u => u.email?.toLowerCase()));

        const missingUsers = publicUsers.filter(u => {
            // Only sync active groups, not '게스트' (unless they need it)
            if (u.user_group === '게스트') return false;
            return !authUserIds.has(u.id);
        });

        console.log(`Found ${missingUsers.length} active users in public.users who do NOT have an auth.users record.`);

        for (const user of missingUsers) {
            if (!user.phone) {
                console.log(`Skipping [${user.name}] because they have no phone number.`);
                continue;
            }
            const phoneDigits = user.phone.replace(/[^0-9]/g, '');
            if (phoneDigits.length < 11) {
                console.log(`Skipping [${user.name}] due to invalid phone: ${user.phone}`);
                continue;
            }
            const fakeEmail = `${phoneDigits}@youth-access.app`;

            if (authEmails.has(fakeEmail.toLowerCase())) {
                console.log(`Email ${fakeEmail} already exists in auth.users but under different ID. Skipping [${user.name}].`);
                continue;
            }

            console.log(`Syncing [${user.name}] (${user.school || 'no school'}) - Email: ${fakeEmail}`);

            // Create user in auth.users
            const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
                id: user.id,
                email: fakeEmail,
                password: user.password, // This is already the SHA-256 hash in public.users
                email_confirm: true,
                user_metadata: {
                    name: user.name,
                    school: user.school
                }
            });

            if (createError) {
                console.error(`Failed to create auth user for [${user.name}]:`, createError.message);
            } else {
                console.log(`Successfully synced [${user.name}]. Auth ID: ${newAuthUser.user.id}`);
            }
        }

        console.log("Sync completed!");
    } catch (err) {
        console.error("Error during sync:", err);
    }
}

syncAllMissingUsers();
