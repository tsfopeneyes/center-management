import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const required = name => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
};

const rl = createInterface({ input, output, terminal: true });
const name = await rl.question('Test login name: ');
const password = await rl.question('Test login password: ');
rl.close();

const supabaseUrl = required('VITE_SUPABASE_URL');
const anonKey = required('VITE_SUPABASE_ANON_KEY');
const baseUrl = required('VITE_ACCOUNT_AUTH_BASE_URL').replace(/\/$/, '');
const memory = new Map();
const storage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
};
const client = () => createClient(supabaseUrl, anonKey, {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage },
});
const post = async (path, body, token) => {
    const response = await fetch(baseUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${path} failed (${response.status}:${result.error || 'unknown'})`);
    return result;
};

let sdk;
try {
    const issued = await post('/login', { action: 'login', protocol: 1, name: name.trim(), password });
    sdk = client();
    const applied = await sdk.auth.setSession({
        access_token: issued.session.access_token,
        refresh_token: issued.session.refresh_token,
    });
    if (applied.error || applied.data.session?.user?.id !== issued.authUserId) throw new Error('SDK session apply failed');

    // Recreate the SDK around the same storage to model a browser/app restart.
    sdk = client();
    const restored = await sdk.auth.getSession();
    if (restored.error || restored.data.session?.user?.id !== issued.authUserId) throw new Error('Persisted session restore failed');
    const token = restored.data.session.access_token;
    const verified = await post('/session', { action: 'session-status', protocol: 1 }, token);
    if (verified.decision !== 'retain' || verified.profileId !== issued.profileId) throw new Error('Session continuity rejected');
    const profile = await post('/profile', { action: 'read', protocol: 1, profileId: verified.profileId }, token);
    if (profile.status !== 'ok' || profile.profile?.id !== issued.profileId) throw new Error('Profile restore failed');
    output.write(JSON.stringify({ ok: true, profileId: issued.profileId, role: profile.profile.role || 'user' }) + '\n');
} finally {
    // Revoke only the isolated session created by this verification.
    if (sdk) await sdk.auth.signOut({ scope: 'local' }).catch(() => {});
    memory.clear();
}
