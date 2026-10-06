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
const client = new pg.Client({
    host: credential('PGHOST'), port: Number(credential('PGPORT')),
    user: credential('PGUSER'), password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: `program-audience-guard-${mode === '--apply' ? 'apply' : 'rollback-dry-run'}`,
});
const sql = (await readFile(new URL('../supabase/manual/proposals/20260930_program_application_audience_write_guard.sql', import.meta.url), 'utf8'))
    .split(/\r?\n/).filter(line => !/^(BEGIN|COMMIT);$/i.test(line.trim())).join('\n');
let transactionOpen = false;
try {
    await client.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '20s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '120s'");
    const identity = (await client.query(`SELECT current_user AS role_name,
        pg_has_role(current_user,'postgres','MEMBER') AS is_owner_member`)).rows[0];
    if (identity.role_name !== 'cli_login_postgres' || identity.is_owner_member !== true) {
        throw new Error('Unexpected linked role; refusing migration');
    }
    await client.query('SET LOCAL ROLE postgres');
    const columns = (await client.query(`SELECT c.relname FROM pg_attribute a
        JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('notice_responses','daily_program_session_responses')
            AND a.attname='application_audience' AND NOT a.attisdropped`)).rows;
    assert.equal(columns.length, 2, 'Audience columns must be applied first');
    const existing = (await client.query(`SELECT tgname FROM pg_trigger
        WHERE tgname IN ('guard_notice_application_audience_write','guard_session_application_audience_write')
            AND NOT tgisinternal`)).rows;
    if (existing.length) throw new Error('Audience guard already present; review partial migration before retrying');
    await client.query(sql);
    const installed = (await client.query(`SELECT tgname FROM pg_trigger
        WHERE tgname IN ('guard_notice_application_audience_write','guard_session_application_audience_write')
            AND NOT tgisinternal`)).rows;
    assert.equal(installed.length, 2);
    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, mode, result: mode === '--apply' ? 'committed' : 'rolled_back',
        protectedTables: columns.length, installedTriggers: installed.length }));
} finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
