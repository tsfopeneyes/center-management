import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { legacyGuestMigrationIssue, legacyGuestQuestions } from '../src/features/programs/applicationFormModel.js';

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
const migrationFiles = [
    '20260930_program_application_audience.sql',
    '20260930_program_application_audience_classification.sql',
    '20260930_program_application_form_source.sql',
    '20260930_program_application_revision_guard.sql',
    '20260929_unified_program_application_boundary.sql',
    '20260930_checked_program_session_requests.sql',
    '20260930_checked_guest_program_registration.sql',
    '20260930_unified_staff_program_walkins.sql',
    '20260930_program_application_audience_write_guard.sql',
    '20260930_atomic_program_settings_save.sql',
];
const migrationSql = await Promise.all(migrationFiles.map(async file => {
    const source = await readFile(new URL(`../supabase/manual/proposals/${file}`, import.meta.url), 'utf8');
    return source.split(/\r?\n/).filter(line => !/^(BEGIN|COMMIT);$/i.test(line.trim())).join('\n');
}));
const client = new pg.Client({
    host: credential('PGHOST'), port: Number(credential('PGPORT')),
    user: credential('PGUSER'), password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: `program-form-source-${mode === '--apply' ? 'apply' : 'dry-run'}`,
});
let transactionOpen = false;
try {
    await client.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '20s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const identity = await client.query(`SELECT current_user AS role_name,
        pg_has_role(current_user, 'postgres', 'MEMBER') AS is_owner_member`);
    if (identity.rows[0]?.role_name !== 'cli_login_postgres' || identity.rows[0]?.is_owner_member !== true) {
        throw new Error('Unexpected linked role; refusing migration');
    }
    await client.query('SET LOCAL ROLE postgres');
    const constraint = await client.query(`SELECT 1 FROM pg_constraint
        WHERE conrelid='public.notices'::regclass AND conname='program_application_form_required'`);
    if (constraint.rowCount) throw new Error('Canonical form constraint already exists');
    const checkedEndpoints = await client.query(`SELECT
        to_regprocedure('public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)') IS NOT NULL AS whole,
        to_regprocedure('public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)') IS NOT NULL AS session,
        to_regprocedure('public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)') IS NOT NULL AS guest`);
    if (Object.values(checkedEndpoints.rows[0]).some(Boolean)) {
        throw new Error('Checked application endpoint already exists; review partial migration');
    }
    const before = await client.query(`SELECT
        (SELECT count(*) FROM public.notices)::integer AS notices,
        (SELECT count(*) FROM public.notice_responses)::integer AS whole_responses,
        (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses,
        (SELECT count(*) FROM public.users)::integer AS users,
        (SELECT count(*) FROM public.survey_links)::integer AS survey_links,
        (SELECT count(*) FROM public.app_notifications)::integer AS notifications`);
    const rows = await client.query(`SELECT id, guest_properties, application_form,
        application_form_revision FROM public.notices WHERE category='PROGRAM' ORDER BY id FOR UPDATE`);
    const pending = rows.rows.filter(row => row.application_form == null);
    for (const row of pending) {
        const issue = legacyGuestMigrationIssue(row.guest_properties);
        if (issue) throw new Error(`Program ${row.id}: ${issue}`);
    }
    for (const row of pending) {
        const form = { questions: legacyGuestQuestions(row.guest_properties) };
        const updated = await client.query(`UPDATE public.notices SET application_form=$2::jsonb
            WHERE id=$1 AND application_form IS NULL
            RETURNING application_form,application_form_revision`, [row.id, JSON.stringify(form)]);
        if (updated.rowCount !== 1 || updated.rows[0].application_form_revision !== 1) {
            throw new Error(`Program ${row.id}: canonical form or revision mismatch`);
        }
        assert.deepEqual(updated.rows[0].application_form.questions, form.questions);
    }
    for (const [index, sql] of migrationSql.entries()) {
        try {
            await client.query(sql);
        } catch (error) {
            throw new Error(`${migrationFiles[index]}: ${error.message}`, { cause: error });
        }
    }
    const remaining = await client.query(`SELECT count(*)::integer AS count FROM public.notices
        WHERE category='PROGRAM' AND application_form IS NULL`);
    if (remaining.rows[0].count !== 0) throw new Error('Programs without canonical form remain');
    const after = await client.query(`SELECT
        (SELECT count(*) FROM public.notices)::integer AS notices,
        (SELECT count(*) FROM public.notice_responses)::integer AS whole_responses,
        (SELECT count(*) FROM public.daily_program_session_responses)::integer AS session_responses,
        (SELECT count(*) FROM public.users)::integer AS users,
        (SELECT count(*) FROM public.survey_links)::integer AS survey_links,
        (SELECT count(*) FROM public.app_notifications)::integer AS notifications`);
    assert.deepEqual(after.rows[0], before.rows[0], 'Application or side-effect table counts changed');
    const afterEndpoints = await client.query(`SELECT
        to_regprocedure('public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)') IS NOT NULL AS whole,
        to_regprocedure('public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)') IS NOT NULL AS session,
        to_regprocedure('public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)') IS NOT NULL AS guest`);
    if (Object.values(afterEndpoints.rows[0]).some(value => value !== true)) {
        throw new Error('Checked application endpoints are incomplete');
    }
    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, mode, result: mode === '--apply' ? 'committed' : 'rolled_back',
        programCount: rows.rowCount, imported: pending.length, migrations: migrationFiles.length,
        withLegacyQuestions: pending.filter(row => (row.guest_properties?.custom_fields || []).length > 0).length,
        preservedCounts: before.rows[0] }));
} finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
