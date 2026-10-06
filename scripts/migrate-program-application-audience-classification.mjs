import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const mode = process.argv[2];
if (!['--dry-run', '--apply'].includes(mode) || process.argv.length !== 3) throw new Error('Use --dry-run or --apply');
const projectRef = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (projectRef !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked Supabase project');
let cliOutput;
try {
    cliOutput = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
} catch { throw new Error('Unable to obtain linked database connection settings'); }
const credential = name => cliOutput.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !credential(name))) {
    throw new Error('Linked database credentials are unavailable');
}
const client = new pg.Client({
    host: credential('PGHOST'), port: Number(credential('PGPORT')),
    user: credential('PGUSER'), password: credential('PGPASSWORD'), database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: `program-audience-classification-${mode === '--apply' ? 'apply' : 'rollback-dry-run'}`,
});
const functions = [
    ['program_application_transition', '20260929_unified_program_application_boundary.sql'],
    ['program_session_transition', '20260929_session_application_answers.sql'],
    ['add_staff_program_walkins', '20260930_unified_staff_program_walkins.sql'],
    ['add_staff_program_session_walkins', '20260929_staff_program_walkins.sql'],
];
const definitions = await Promise.all(functions.map(async ([name, file]) => {
    const source = await readFile(new URL(`../supabase/manual/proposals/${file}`, import.meta.url), 'utf8');
    const start = source.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`));
    const end = source.indexOf('$$;', start);
    if (start < 0 || end < 0) throw new Error(`Missing reviewed source function: ${name}`);
    const definition = source.slice(start, end + 3).replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION');
    if (!definition.includes('program_application_audience_for_user')) throw new Error(`Classification missing from ${name}`);
    return definition;
}));
const classification = (await readFile(new URL('../supabase/manual/proposals/20260930_program_application_audience_classification.sql', import.meta.url), 'utf8'))
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
    const ready = (await client.query(`SELECT
        to_regprocedure('public.program_application_audience_for_user(uuid)') IS NULL AS helper_missing,
        (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname IN ('notice_responses','daily_program_session_responses')
                AND a.attname='application_audience' AND NOT a.attisdropped)::integer AS audience_columns,
        (SELECT count(*) FROM pg_trigger WHERE tgname IN
            ('guard_notice_application_audience_write','guard_session_application_audience_write')
            AND NOT tgisinternal)::integer AS guard_triggers`)).rows[0];
    assert.deepEqual(ready, { helper_missing: true, audience_columns: 2, guard_triggers: 2 });
    const before = (await client.query(`SELECT
        (SELECT count(*) FROM public.notice_responses)::integer AS whole,
        (SELECT count(*) FROM public.daily_program_session_responses)::integer AS sessions,
        (SELECT count(*) FROM public.program_application_attempt_history)::integer AS whole_history,
        (SELECT count(*) FROM public.program_session_application_attempt_history)::integer AS session_history`)).rows[0];
    await client.query(classification);
    for (const definition of definitions) await client.query(definition);
    const after = (await client.query(`SELECT
        (SELECT count(*) FROM public.notice_responses)::integer AS whole,
        (SELECT count(*) FROM public.daily_program_session_responses)::integer AS sessions,
        (SELECT count(*) FROM public.program_application_attempt_history)::integer AS whole_history,
        (SELECT count(*) FROM public.program_session_application_attempt_history)::integer AS session_history`)).rows[0];
    assert.deepEqual(after, before, 'Application row counts changed');
    const helper = (await client.query(`SELECT
        public.program_application_audience_for_user(NULL::uuid) AS unknown,
        to_regprocedure('public.program_application_audience_for_user(uuid)') IS NOT NULL AS installed`)).rows[0];
    assert.equal(helper.unknown, null);
    assert.equal(helper.installed, true);
    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, mode, result: mode === '--apply' ? 'committed' : 'rolled_back',
        functions: definitions.length + 1, preservedCounts: before }));
} finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
