import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
  ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name)))
  throw new Error('Linked credentials unavailable');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
  user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
  ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
  connectionTimeoutMillis: 10000, application_name: 'read-only-challenge-migration-impact' });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query('SET LOCAL ROLE postgres');
  const { rows: [schema] } = await client.query(`SELECT
    current_setting('server_version_num')::integer AS server_version,
    to_regclass('public.open_program_attendance') IS NOT NULL AS open_attendance_exists,
    to_regclass('public.program_close_reward_grants') IS NOT NULL AS close_ledger_exists,
    (SELECT count(*)::integer FROM public.notices WHERE is_challenge AND program_status IS DISTINCT FROM 'COMPLETED') AS active_challenges,
    (SELECT count(*)::integer FROM public.online_challenge_submissions WHERE is_valid) AS valid_online_submissions,
    (SELECT count(*)::integer FROM public.challenge_completion_rewards) AS existing_completion_rewards,
    (SELECT count(*)::integer FROM public.notices WHERE program_status IS DISTINCT FROM 'COMPLETED' AND haifn_reward > 0) AS future_reward_programs`);
  const { rows: functions } = await client.query(`SELECT proname, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND proname IN
      ('prepare_online_challenge_submission','sync_challenge_missions',
       'validate_online_challenge_mission','reward_survey_entry')`);
  const definitions = Object.fromEntries(functions.map(row => [row.proname, row.definition]));
  const { rows: migrationColumns } = await client.query(`SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='supabase_migrations'
      AND table_name='schema_migrations' ORDER BY ordinal_position`);
  const { rows: pendingVersions } = await client.query(`SELECT version FROM supabase_migrations.schema_migrations
    WHERE version LIKE '20260920%' ORDER BY version`);
  const { rows: hostAssignments } = await client.query(`SELECT n.id, n.title, c.name AS channel_name,
    (SELECT array_agg(DISTINCT u.name ORDER BY u.name) FROM public.users u
      WHERE u.id = n.host_id OR u.id = ANY(COALESCE(n.host_ids, '{}'::uuid[]))
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.hosts)='array'
          THEN n.hosts ELSE '[]'::jsonb END) h WHERE h->>'host_id'=u.id::text)) AS host_names
    FROM public.notices n LEFT JOIN public.community_channels c ON c.source_notice_id=n.id
    WHERE n.is_challenge AND n.challenge_format='ONLINE' AND n.program_status IS DISTINCT FROM 'COMPLETED'
    ORDER BY n.id DESC LIMIT 10`);
  const anchors = {
    submission_auth: definitions.prepare_online_challenge_submission?.includes('AND NOT public.is_community_admin() THEN'),
    submission_notice: definitions.prepare_online_challenge_submission?.includes('SELECT * INTO v_notice FROM public.notices WHERE id = v_mission.challenge_id;'),
    mission_sync_auth: definitions.sync_challenge_missions?.includes('IF NOT public.is_community_admin() THEN'),
    mission_sync_guard: definitions.sync_challenge_missions?.includes('GREATEST(1, COALESCE(NULLIF(v_item->>\'target_count\', \'\')::integer, 1)) <'),
    mission_guard: definitions.validate_online_challenge_mission?.includes('OR NEW.target_count < (SELECT count(*) FROM public.online_challenge_submissions s WHERE s.mission_id = OLD.id AND s.is_valid))'),
    survey_guard: definitions.reward_survey_entry?.includes('IF NOT coalesce(program.is_review_required,false) OR coalesce(program.haifn_reward,0)<=0 THEN RETURN NEW; END IF;'),
  };
  console.log(JSON.stringify({ schema, anchors, migrationColumns, pendingVersions, hostAssignments }));
  await client.query('ROLLBACK');
} finally { await client.end(); }
