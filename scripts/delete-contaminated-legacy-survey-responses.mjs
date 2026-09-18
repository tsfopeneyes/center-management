import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { legacySurveyResponsesForSurvey } from '../src/utils/legacySurveyAnalytics.js';

const apply = process.argv.includes('--apply');
const surveyId = '95c6cd4d-35a0-40dc-b3bd-98b41423a4ff';
const expectedIds = [
    'ccdd818f-4cdd-471f-bd97-b127dc123952', '34bc2e5c-014d-41c6-ac2e-f2dafe4ff97b',
    '8766991f-7f51-4487-a059-aa1b4f30e8af', 'b2ba28ab-6a30-4a6a-bb4d-eca16f551483',
    '04eb66e6-c344-4227-9494-1b5596fc92ab', 'bf58732d-5047-4c48-aabe-6252323ca996',
    'ce92efb6-d8d9-4dca-b159-3079395d2ebc', 'f75592ee-ecaa-45e1-9ad7-1dd07da83bf4',
    'a3cc7f7b-9535-42a1-9b9c-0ddeb0c6efd0', '92008558-a303-4dcb-816a-53bb40185c70',
    '0f921bfc-7fa8-44ad-84da-1f27f0925126', '9f8e0fb8-9db5-4ac6-979b-ebb45d986259',
    '7e5cbb82-c786-4c75-bf35-302c304b6c3a', '217ff16d-5969-4b55-8482-725f6cc93f82',
    'a6de9ad3-464b-44ca-afc4-d5d86b54d3e1',
].sort();
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name))) throw new Error('Linked credentials unavailable');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'approved-contaminated-legacy-survey-deletion' });
let backupPath = null;
try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const survey = (await client.query('SELECT * FROM public.surveys WHERE id=$1', [surveyId])).rows[0];
    if (survey?.title !== '센터에 어떤 것들이 있으면 좋을까요?' || survey.survey_type !== 'CHECKIN') throw new Error('Unexpected survey');
    const responses = (await client.query(`SELECT * FROM public.checkin_surveys
      WHERE survey_type='CHECKIN' OR survey_type IS NULL`)).rows;
    const users = (await client.query('SELECT id,name,role,user_group FROM public.users')).rows;
    const matched = legacySurveyResponsesForSurvey({ survey, responses, users });
    const ids = matched.map(row => row.id).sort();
    if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) throw new Error('Displayed legacy response set changed; repeat the audit');
    const rows = (await client.query('SELECT * FROM public.checkin_surveys WHERE id=ANY($1::uuid[]) FOR UPDATE', [ids])).rows;
    if (rows.length !== ids.length) throw new Error('Some target rows disappeared');
    const otherSurvey = (await client.query(`SELECT * FROM public.surveys WHERE id<>$1 AND survey_type='CHECKIN'`, [surveyId])).rows;
    if (otherSurvey.some(other => legacySurveyResponsesForSurvey({ survey: other, responses, users }).some(row => ids.includes(row.id)))) {
        throw new Error('Target rows also belong to another survey');
    }
    const countsBefore = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.checkin_surveys) AS legacy_responses,
      (SELECT count(*)::int FROM public.survey_entries WHERE form_id=$1) AS modern_entries,
      (SELECT count(*)::int FROM public.logs) AS logs`, [surveyId])).rows[0];
    const digest = async () => (await client.query(`SELECT md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY c.id),'')) AS value
      FROM public.checkin_surveys c WHERE c.id=ANY($1::uuid[])`, [ids])).rows[0].value;
    const beforeDigest = await digest();
    const removed = (await client.query('DELETE FROM public.checkin_surveys WHERE id=ANY($1::uuid[]) RETURNING id', [ids])).rows;
    if (removed.length !== ids.length) throw new Error('Deleted row count mismatch');
    const countsAfter = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.checkin_surveys) AS legacy_responses,
      (SELECT count(*)::int FROM public.survey_entries WHERE form_id=$1) AS modern_entries,
      (SELECT count(*)::int FROM public.logs) AS logs`, [surveyId])).rows[0];
    if (countsAfter.legacy_responses !== countsBefore.legacy_responses - ids.length ||
        countsAfter.modern_entries !== countsBefore.modern_entries || countsAfter.logs !== countsBefore.logs) {
        throw new Error('Protected row counts changed');
    }
    if (!apply) {
        const restored = (await client.query(`INSERT INTO public.checkin_surveys
          SELECT * FROM json_populate_recordset(NULL::public.checkin_surveys, $1::json)
          RETURNING id`, [JSON.stringify(rows)])).rows;
        if (restored.length !== ids.length || await digest() !== beforeDigest) throw new Error('Recovery drill failed');
        await client.query('ROLLBACK');
        console.log(JSON.stringify({ status: 'dry_run_passed', project, surveyId, targetRows: ids.length,
            countsBefore, countsAfterDelete: countsAfter, restoredInRollback: restored.length }));
    } else {
        const base = path.resolve('backups');
        await mkdir(base, { recursive: true });
        if (await realpath(base) !== base) throw new Error('Backup directory resolves outside the workspace');
        backupPath = path.join(base, `legacy-survey-${surveyId}-${Date.now()}.json`);
        const backup = JSON.stringify({ project, surveyId, rows });
        await writeFile(backupPath, backup, { flag: 'wx', mode: 0o600 });
        if (createHash('sha256').update(await readFile(backupPath)).digest('hex') !==
            createHash('sha256').update(backup).digest('hex')) throw new Error('Backup verification failed');
        await client.query('COMMIT');
        console.log(JSON.stringify({ status: 'deleted', project, surveyId, targetRows: ids.length,
            countsBefore, countsAfter, backupPath }));
    }
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', message: error.message, backupPath }));
    process.exitCode = 1;
} finally { await client.end(); }
