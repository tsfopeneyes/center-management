import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { legacySurveyResponsesForSurvey } from '../src/utils/legacySurveyAnalytics.js';

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
    connectionTimeoutMillis: 10000, application_name: 'legacy-survey-response-readonly-audit' });
try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL statement_timeout='20s'");
    const forms = (await client.query(`SELECT f.id, f.title, f.kind, f.archived,
      v.definition->'legacySource' AS legacy_source,
      (SELECT count(*)::int FROM public.survey_entries e WHERE e.form_id=f.id) AS modern_entries
      FROM public.survey_forms f
      LEFT JOIN LATERAL (SELECT definition FROM public.survey_versions WHERE form_id=f.id ORDER BY created_at LIMIT 1) v ON true
      ORDER BY f.created_at`)).rows;
    const surveys = (await client.query(`SELECT s.id,s.title,s.survey_type,s.is_legacy,
      (SELECT count(*)::int FROM public.checkin_surveys c WHERE c.survey_id=s.id) AS direct_rows,
      (SELECT count(*)::int FROM public.checkin_surveys c WHERE c.survey_id IS NULL AND coalesce(c.survey_type,'CHECKIN')=s.survey_type) AS unassigned_type_rows
      FROM public.surveys s ORDER BY s.created_at`)).rows;
    const columns = (await client.query(`SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='checkin_surveys' ORDER BY ordinal_position`)).rows;
    const total = (await client.query(`SELECT count(*)::int AS all_legacy_rows,
      count(*) FILTER (WHERE survey_id IS NULL)::int AS unassigned_rows
      FROM public.checkin_surveys`)).rows[0];
    const target = (await client.query(`SELECT * FROM public.surveys WHERE title=$1`, ['센터에 어떤 것들이 있으면 좋을까요?'])).rows[0];
    const responses = (await client.query(`SELECT * FROM public.checkin_surveys WHERE survey_type='CHECKIN' OR survey_type IS NULL`)).rows;
    const users = (await client.query(`SELECT id,name,role,user_group FROM public.users`)).rows;
    const matched = legacySurveyResponsesForSurvey({ survey: target, responses, users });
    const matching = matched.map(row => ({ id: row.id, survey_id: row.survey_id, created_at: new Date(row.created_at).toISOString(),
      excluded: row.aggregation_excluded === true, has_snapshot: Boolean(row.survey_snapshot),
      selections: row.selections?.length || 0 })).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const otherSurvey = (await client.query(`SELECT * FROM public.surveys WHERE id<>$1 AND survey_type=$2`, [target.id, target.survey_type])).rows;
    const overlap = otherSurvey.map(survey => ({ id: survey.id,
      matchingRows: legacySurveyResponsesForSurvey({ survey, responses, users }).filter(row => matching.some(item => item.id === row.id)).length }));
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ project, readOnly: true, forms, surveys, columns, total,
      target: { id: target.id, title: target.title, shownLegacyCount: matching.length, matching, overlap } }));
} finally { await client.end(); }
