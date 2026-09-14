import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const authBase = process.env.VITE_ACCOUNT_AUTH_BASE_URL;
assert.equal(new URL(url).hostname, 'erecqalsxoxrufggvmcc.supabase.co');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const invalidGuest = { p_session_id: '00000000-0000-4000-8000-000000000000', p_user_id: '00000000-0000-4000-8000-000000000000',
    p_name: '배포검증_존재하지않는이용자', p_phone: '01000000000', p_birth: '080315', p_answers: {} };
// Invalid identity is rejected before any insert, so no production test records.
const rpc = await fetch(`${url}/rest/v1/rpc/apply_guest_program_session`, { method: 'POST', headers, body: JSON.stringify(invalidGuest) });
assert.ok([401,403].includes(rpc.status));
assert.equal((await rpc.json()).code, '42501');
const fallback = await fetch(`${url}/rest/v1/guest_program_session_applications`, { method: 'POST', headers,
    body: JSON.stringify({ session_id: invalidGuest.p_session_id, user_id: invalidGuest.p_user_id,
        name: invalidGuest.p_name, phone: invalidGuest.p_phone, birth: invalidGuest.p_birth, application_answers: {} }) });
assert.ok([401,403].includes(fallback.status));
assert.equal((await fallback.json()).code, '42501');
const view = await fetch(`${url}/rest/v1/guest_program_session_applications?select=*`, { headers });
assert.equal(view.status, 200);
assert.deepEqual(await view.json(), []);

const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore','pipe','ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')), user: value('PGUSER'),
    password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'), rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
let sample;
try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL ROLE postgres');
    sample = (await client.query(`SELECT u.id,u.name FROM public.users u
        JOIN account_security.accounts a ON a.profile_id=u.id
        JOIN account_security.login_identifiers i ON i.profile_id=u.id
        WHERE a.mapping_verified AND a.status='active' AND i.enabled AND length(btrim(u.name))>0
        ORDER BY u.id LIMIT 1`)).rows[0];
    await client.query('ROLLBACK');
} finally { await client.end(); }
assert.ok(sample);
const response = await fetch(`${authBase.replace(/\/$/,'')}/candidates`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.schoolchurchimpact.org' },
    body: JSON.stringify({ protocol: 1, name: sample.name }) });
assert.equal(response.status, 200);
const body = await response.json();
assert.ok(body.candidates.some(row => row.profileId === sample.id && row.name === sample.name));
console.log(JSON.stringify({ guestRpcDeployed: true, guardedFallbackDeployed: true, noGuestRecordsDisclosed: true,
    liveCanonicalNameLookup: true, productionTestRecordsCreated: 0 }));
