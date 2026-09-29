import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const mode = process.argv[2];
if (!['--dry-run', '--apply'].includes(mode) || process.argv.length !== 3) {
    throw new Error('Use exactly --dry-run or --apply');
}
const projectRef = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (projectRef !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked Supabase project');
let cliOutput;
try {
    cliOutput = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
} catch {
    throw new Error('Unable to obtain linked database connection settings');
}
const credential = name => cliOutput.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !credential(name))) {
    throw new Error('Linked database credentials are unavailable');
}
const source = await readFile(new URL('../supabase/manual/proposals/20260930_retire_unchecked_program_application_writes.sql', import.meta.url), 'utf8');
const sql = source.split(/\r?\n/).filter(line => !/^(BEGIN|COMMIT);$/i.test(line.trim())).join('\n');
const db = new pg.Client({
    host: credential('PGHOST'), port: Number(credential('PGPORT')),
    user: credential('PGUSER'), password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: `program-final-cutover-${mode === '--apply' ? 'apply' : 'dry-run'}`,
});
let transactionOpen = false;
const countsSql = `SELECT
    (SELECT count(*) FROM public.notices)::integer AS notices,
    (SELECT count(*) FROM public.notice_responses)::integer AS whole_responses,
    (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses,
    (SELECT count(*) FROM public.users)::integer AS users,
    (SELECT count(*) FROM public.program_push_jobs)::integer AS push_jobs,
    (SELECT count(*) FROM public.app_notifications)::integer AS notifications`;
const newEndpointSql = `SELECT
    has_function_privilege('authenticated', 'public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)', 'EXECUTE') AS whole,
    has_function_privilege('authenticated', 'public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)', 'EXECUTE') AS session,
    has_function_privilege('authenticated', 'public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)', 'EXECUTE') AS guest,
    has_function_privilege('authenticated', 'public.save_program_settings_atomic(bigint,jsonb,integer,jsonb,jsonb)', 'EXECUTE') AS settings,
    has_table_privilege('authenticated', 'public.member_program_application_checked_requests', 'INSERT') AS whole_fallback,
    has_table_privilege('authenticated', 'public.member_program_session_checked_requests', 'INSERT') AS session_fallback,
    has_table_privilege('authenticated', 'public.guest_program_registration_checked_requests', 'INSERT') AS guest_fallback,
    has_table_privilege('authenticated', 'public.program_settings_save_requests', 'INSERT') AS settings_fallback`;
const oldEndpointSql = `SELECT
    has_function_privilege('authenticated', 'public.respond_to_program_application(bigint,uuid,text,jsonb)', 'EXECUTE') AS whole,
    has_function_privilege('authenticated', 'public.respond_to_program_session(uuid,uuid,text,jsonb)', 'EXECUTE') AS session,
    has_function_privilege('authenticated', 'public.register_guest_program_application(bigint,uuid,jsonb,jsonb)', 'EXECUTE') AS guest,
    has_table_privilege('authenticated', 'public.member_program_applications', 'INSERT') AS whole_fallback,
    has_table_privilege('authenticated', 'public.member_program_session_applications', 'INSERT') AS session_fallback,
    has_table_privilege('authenticated', 'public.guest_program_registration_requests', 'INSERT') AS guest_fallback`;
try {
    await db.connect();
    await db.query('BEGIN');
    transactionOpen = true;
    await db.query("SET LOCAL statement_timeout = '20s'");
    await db.query("SET LOCAL lock_timeout = '3s'");
    const identity = await db.query(`SELECT current_user AS role_name,
        pg_has_role(current_user, 'postgres', 'MEMBER') AS is_owner_member`);
    if (identity.rows[0]?.role_name !== 'cli_login_postgres' || identity.rows[0]?.is_owner_member !== true) {
        throw new Error('Unexpected linked role; refusing final cutover');
    }
    await db.query('SET LOCAL ROLE postgres');
    const before = (await db.query(countsSql)).rows[0];
    const available = (await db.query(newEndpointSql)).rows[0];
    if (Object.values(available).some(value => value !== true)) {
        throw new Error('Checked endpoint or direct relation fallback is not available');
    }
    const oldBefore = (await db.query(oldEndpointSql)).rows[0];
    if (Object.values(oldBefore).every(value => value === false)) {
        throw new Error('Unchecked endpoints already retired; review current schema');
    }
    await db.query(sql);
    const after = (await db.query(countsSql)).rows[0];
    assert.deepEqual(after, before, 'Application or notification counts changed');
    const retained = (await db.query(newEndpointSql)).rows[0];
    if (Object.values(retained).some(value => value !== true)) {
        throw new Error('Checked endpoint lost access');
    }
    const retired = (await db.query(oldEndpointSql)).rows[0];
    if (Object.values(retired).some(value => value !== false)) {
        throw new Error('Unchecked endpoint still accessible');
    }
    await db.query("NOTIFY pgrst, 'reload schema'");
    await db.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, mode, result: mode === '--apply' ? 'committed' : 'rolled_back', preservedCounts: before }));
} finally {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {});
    await db.end().catch(() => {});
}
