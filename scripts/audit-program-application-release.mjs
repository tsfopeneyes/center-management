import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const expected = process.argv[2];
if (!['--prepared', '--cutover'].includes(expected) || process.argv.length !== 3) {
    throw new Error('Use exactly --prepared or --cutover');
}
const expectedProjectRef = 'erecqalsxoxrufggvmcc';
const projectRef = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (projectRef !== expectedProjectRef) throw new Error('Unexpected linked Supabase project');
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
const client = new pg.Client({
    host: credential('PGHOST'), port: Number(credential('PGPORT')),
    user: credential('PGUSER'), password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: 'read-only-program-application-release-audit',
});
let open = false;
try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    open = true;
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL ROLE postgres");
    const result = await client.query(`SELECT
        (SELECT count(*) FROM public.notices)::integer AS notices,
        (SELECT count(*) FROM public.notice_responses)::integer AS whole_responses,
        (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses,
        (SELECT count(*) FROM public.users)::integer AS users,
        (SELECT count(*) FROM public.program_application_attempt_history)::integer AS whole_archives,
        (SELECT count(*) FROM public.program_session_application_attempt_history)::integer AS session_archives,
        to_regprocedure('public.respond_to_program_application(bigint,uuid,text,jsonb)') IS NOT NULL AS whole_endpoint,
        to_regprocedure('public.register_guest_program_application(bigint,uuid,jsonb,jsonb)') IS NOT NULL AS guest_endpoint,
        to_regprocedure('public.add_staff_program_walkins(bigint,uuid[])') IS NOT NULL AS staff_endpoint,
        EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notice_responses'
            AND policyname='program_application_verified_insert') AS whole_cutover,
        EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users'
            AND policyname='program_guest_registration_verified_insert') AS guest_cutover,
        EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
            AND tablename='daily_program_session_responses'
            AND policyname='daily_session_responses_write_own') AS old_session_write_policy`);
    const state = result.rows[0];
    if (!state.whole_endpoint || !state.guest_endpoint || !state.staff_endpoint
        || state.old_session_write_policy
        || (expected === '--prepared' && (state.whole_archives !== 0 || state.session_archives !== 0))
        || state.whole_cutover !== (expected === '--cutover')
        || state.guest_cutover !== (expected === '--cutover')) {
        throw new Error('Release state does not match expected phase');
    }
    console.log(JSON.stringify({ projectRef, phase: expected, state }));
    await client.query('ROLLBACK');
    open = false;
} finally {
    if (open) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
