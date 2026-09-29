import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

// This script is intentionally limited to the additive form/snapshot schema.
// It never copies or deletes application rows and does not run cutover DDL.
const mode = process.argv[2];
if (!['--dry-run', '--apply'].includes(mode) || process.argv.length !== 3) {
    throw new Error('Use exactly --dry-run or --apply');
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

const migrationSource = await readFile(
    new URL('../supabase/manual/proposals/20260929_application_form_snapshots.sql', import.meta.url), 'utf8'
);
const migrationSql = migrationSource.split(/\r?\n/)
    .filter(line => !/^(BEGIN|COMMIT);$/i.test(line.trim()))
    .join('\n');
if (!migrationSql.includes('CREATE TRIGGER revise_program_application_form')
    || !migrationSql.includes('ALTER TABLE public.daily_program_session_responses')) {
    throw new Error('Unexpected migration source');
}

const expectedColumns = [
    ['notices', 'application_form', 'jsonb'],
    ['notices', 'application_form_revision', 'integer'],
    ['notice_responses', 'application_form_revision', 'integer'],
    ['notice_responses', 'application_form_snapshot', 'jsonb'],
    ['daily_program_session_responses', 'application_form_revision', 'integer'],
    ['daily_program_session_responses', 'application_form_snapshot', 'jsonb'],
];
const expectedFunctions = [
    'validate_program_application_form',
    'validate_program_application_answers',
    'revise_program_application_form',
];
const client = new pg.Client({
    host: credential('PGHOST'),
    port: Number(credential('PGPORT')),
    user: credential('PGUSER'),
    password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: `program-form-snapshot-${mode === '--apply' ? 'apply' : 'dry-run'}`,
});

const readState = async () => {
    const columns = await client.query(`
        SELECT cls.relname AS table_name, attr.attname AS column_name,
            format_type(attr.atttypid, attr.atttypmod) AS data_type,
            attr.attnotnull AS not_null
        FROM pg_attribute attr
        JOIN pg_class cls ON cls.oid = attr.attrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = ANY($1::text[])
            AND attr.attname = ANY($2::text[])
            AND attr.attnum > 0 AND NOT attr.attisdropped
    `, [expectedColumns.map(item => item[0]), expectedColumns.map(item => item[1])]);
    const functions = await client.query(`
        SELECT proc.proname FROM pg_proc proc
        JOIN pg_namespace ns ON ns.oid = proc.pronamespace
        WHERE ns.nspname = 'public' AND proc.proname = ANY($1::text[])
    `, [expectedFunctions]);
    const triggers = await client.query(`
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'public.notices'::regclass
            AND tgname = 'revise_program_application_form' AND NOT tgisinternal
    `);
    return { columns: columns.rows, functions: functions.rows, triggers: triggers.rows };
};

let transactionOpen = false;
try {
    await client.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const identity = await client.query(`
        SELECT current_user AS role_name,
            pg_has_role(current_user, 'postgres', 'MEMBER') AS is_owner_member
    `);
    if (identity.rows[0]?.role_name !== 'cli_login_postgres'
        || identity.rows[0]?.is_owner_member !== true) {
        throw new Error('Unexpected linked role; refusing migration');
    }
    await client.query('SET LOCAL ROLE postgres');

    const before = await readState();
    if (before.columns.length || before.functions.length || before.triggers.length) {
        throw new Error('Migration objects already exist; review partial or prior application');
    }
    const counts = await client.query(`
        SELECT (SELECT count(*) FROM public.notices)::integer AS notices,
            (SELECT count(*) FROM public.notice_responses)::integer AS notice_responses,
            (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses
    `);
    await client.query(migrationSql);
    const after = await readState();
    for (const [table, column, type] of expectedColumns) {
        if (!after.columns.some(row => row.table_name === table
            && row.column_name === column && row.data_type === type)) {
            throw new Error(`Missing or mismatched column: ${table}.${column}`);
        }
    }
    if (after.functions.length !== expectedFunctions.length || after.triggers.length !== 1) {
        throw new Error('Missing expected function or trigger');
    }
    const afterCounts = await client.query(`
        SELECT (SELECT count(*) FROM public.notices)::integer AS notices,
            (SELECT count(*) FROM public.notice_responses)::integer AS notice_responses,
            (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses
    `);
    if (JSON.stringify(counts.rows[0]) !== JSON.stringify(afterCounts.rows[0])) {
        throw new Error('Application row counts changed during migration');
    }
    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, mode, result: mode === '--apply' ? 'committed' : 'rolled_back',
        columns: expectedColumns.length, functions: expectedFunctions.length, triggers: 1,
        preservedCounts: counts.rows[0] }));
} finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
