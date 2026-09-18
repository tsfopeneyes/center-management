import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name))) throw new Error('Linked credentials unavailable');
const sql = await readFile('supabase/manual/proposals/20260918_delete_survey_forms.sql', 'utf8');
const body = sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'approved-survey-form-deletion-migration' });

const snapshot = async () => (await client.query(`SELECT
    (SELECT count(*)::int FROM public.survey_forms) AS forms,
    (SELECT count(*)::int FROM public.survey_versions) AS versions,
    (SELECT count(*)::int FROM public.survey_links) AS links,
    (SELECT count(*)::int FROM public.survey_entries) AS entries,
    (SELECT count(*)::int FROM public.surveys) AS legacy_surveys,
    (SELECT count(*)::int FROM public.checkin_surveys) AS legacy_responses,
    (SELECT count(*)::int FROM public.logs) AS logs`)).rows[0];

try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const before = await snapshot();
    const existing = (await client.query(`SELECT
        to_regprocedure('public.delete_survey_form(uuid)') IS NOT NULL AS rpc,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'survey_%_delete') AS delete_policies,
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid='public.survey_versions'::regclass AND tgname='guard_survey_version' AND NOT tgisinternal) AS version_triggers`)).rows[0];
    if (existing.rpc || existing.delete_policies || existing.version_triggers !== 1) throw new Error('Unexpected schema state; review before retrying');
    const summary = (await client.query(`SELECT kind, count(*)::int AS forms,
        count(*) FILTER (WHERE archived)::int AS archived
        FROM public.survey_forms GROUP BY kind ORDER BY kind`)).rows;
    await client.query(body);
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Existing data changed; rolling back');
    const created = (await client.query(`SELECT to_regprocedure('public.delete_survey_form(uuid)') IS NOT NULL AS rpc,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'survey_%_delete') AS delete_policies`)).rows[0];
    if (!created.rpc || created.delete_policies !== 4) throw new Error('Migration objects missing; rolling back');
    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    console.log(JSON.stringify({ status: apply ? 'applied' : 'dry_run_passed', project,
        sha256: createHash('sha256').update(sql).digest('hex'), before, after, summary, created }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation', message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally { await client.end(); }
