import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Review-only production compatibility check. Every DDL statement runs inside
// one bounded transaction, and the transaction always rolls back. No user
// rows or raw logs are printed or changed.
const expectedProjectRef = 'erecqalsxoxrufggvmcc';
const projectRef = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (projectRef !== expectedProjectRef) throw new Error('Unexpected linked Supabase project');

const files = [
    '20260929_program_application_cancellation_history.sql',
    '20260929_session_application_attempt_history.sql',
    '20260930_program_application_audience.sql',
    '20260930_program_application_audience_classification.sql',
    '20260929_program_application_transition.sql',
    '20260929_member_session_write_boundary.sql',
    '20260929_session_application_answers.sql',
    '20260929_atomic_guest_program_registration.sql',
    '20260929_staff_program_walkins.sql',
    '20260930_program_application_audience_write_guard.sql',
    '20260929_program_application_direct_write_cutover.sql',
    '20260929_guest_registration_legacy_cutover.sql',
];

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
    application_name: 'program-application-release-rollback-dry-run',
});

let transactionOpen = false;
let stage = 'connect';
try {
    await client.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '120s'");
    const identity = await client.query(`
        SELECT current_user AS role_name,
            pg_has_role(current_user, 'postgres', 'MEMBER') AS is_owner_member
    `);
    if (identity.rows[0]?.role_name !== 'cli_login_postgres'
        || identity.rows[0]?.is_owner_member !== true) {
        throw new Error('Unexpected linked role; refusing dry-run');
    }
    await client.query('SET LOCAL ROLE postgres');
    const before = await client.query(`
        SELECT (SELECT count(*) FROM public.notices)::integer AS notices,
            (SELECT count(*) FROM public.notice_responses)::integer AS whole_responses,
            (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses,
            (SELECT count(*) FROM public.users)::integer AS users
    `);
    for (const file of files) {
        stage = file;
        const source = await readFile(new URL(`../supabase/manual/proposals/${file}`, import.meta.url), 'utf8');
        if (!/^BEGIN;\s*$/m.test(source) || !/^COMMIT;\s*$/m.test(source)) {
            throw new Error(`Unexpected transaction wrapper in ${file}`);
        }
        const sql = source.split(/\r?\n/)
            .filter(line => !/^(BEGIN|COMMIT);$/i.test(line.trim())).join('\n');
        await client.query(sql);
    }
    const after = await client.query(`
        SELECT (SELECT count(*) FROM public.notices)::integer AS notices,
            (SELECT count(*) FROM public.notice_responses)::integer AS whole_responses,
            (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses,
            (SELECT count(*) FROM public.users)::integer AS users
    `);
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0])) {
        throw new Error('Application or user row counts changed during dry-run');
    }
    await client.query('ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, result: 'rolled_back', migrations: files.length,
        preservedCounts: before.rows[0] }));
} catch (error) {
    console.error(JSON.stringify({ projectRef, result: 'failed_and_rolled_back', stage,
        code: error?.code || null, message: error?.message || String(error) }));
    process.exitCode = 1;
} finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
