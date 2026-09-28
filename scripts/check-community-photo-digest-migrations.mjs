import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const apply = process.argv.includes('--apply');

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
    connectionTimeoutMillis: 10000, application_name: 'community-photo-digest-dry-run' });
const counts = async () => (await client.query(`SELECT
    (SELECT count(*)::int FROM public.community_channel_posts) AS posts,
    (SELECT count(*)::int FROM public.community_post_media) AS media,
    (SELECT count(*)::int FROM public.community_channel_comments) AS comments,
    (SELECT count(*)::int FROM public.community_post_push_recipients) AS push_queue,
    (SELECT count(*)::int FROM public.logs) AS logs`)).rows[0];
try {
    await client.connect();
    const existing = (await client.query(`SELECT
        to_regprocedure('public.create_online_challenge_post_with_media(jsonb,boolean)') IS NOT NULL AS media,
        to_regclass('public.community_post_push_digests') IS NOT NULL AS digest,
        to_regprocedure('public.online_challenge_day(timestamp with time zone)') IS NOT NULL AS mission_day`)).rows[0];
    if (Object.values(existing).some(Boolean)) {
        if (Object.values(existing).every(Boolean)) {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE postgres');
            const verified = (await client.query(`SELECT
                public.online_challenge_day('2026-09-19T03:59:00+09:00'::timestamptz) = '2026-09-18'::date AS previous_day,
                public.online_challenge_day('2026-09-19T04:00:00+09:00'::timestamptz) = '2026-09-19'::date AS new_day,
                position('public.online_challenge_day()' in pg_get_functiondef('public.create_online_challenge_post(jsonb)'::regprocedure)) > 0 AS create_uses_cutoff,
                position('public.online_challenge_day()' in pg_get_functiondef('public.prepare_online_challenge_submission()'::regprocedure)) > 0 AS submission_uses_cutoff,
                position('public.online_challenge_day()' in pg_get_functiondef('public.update_online_challenge_post(uuid,uuid,text,uuid)'::regprocedure)) > 0 AS edit_uses_cutoff,
                (SELECT count(*)::int FROM public.community_post_push_digests) AS pending_digest_rows,
                (SELECT count(*)::int FROM public.community_comment_push_recipients) AS comment_queue_rows`)).rows[0];
            if (!verified.previous_day || !verified.new_day || !verified.create_uses_cutoff
                || !verified.submission_uses_cutoff || !verified.edit_uses_cutoff)
                throw new Error('Applied migration did not pass live verification');
            await client.query('ROLLBACK');
            console.log(JSON.stringify({ status: 'applied_verified', project, existing, verified }));
            await client.end();
            process.exit(0);
        }
        throw new Error('Partial migration state; review before applying');
    }
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const before = await counts();
    for (const file of [
        'supabase/migrations/20260919020000_multiple_community_post_images.sql',
        'supabase/migrations/20260919030000_community_morning_digest.sql',
        'supabase/migrations/20260919040000_online_challenge_day_0400.sql',
    ]) await client.query(await readFile(file, 'utf8'));
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error('Existing row counts changed during dry run');
    const schema = (await client.query(`SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
            AND table_name='users' AND column_name='account_role') AS user_account_role,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
            AND table_name='users' AND column_name='role') AS user_role,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
            AND table_name='users' AND column_name='is_master') AS user_is_master,
        to_regprocedure('public.create_online_challenge_post_with_media(jsonb,boolean)') IS NOT NULL AS create_media,
        to_regprocedure('public.replace_community_post_media(uuid,uuid,text[],text[])') IS NOT NULL AS replace_media,
        to_regprocedure('public.claim_community_post_push_digests(integer)') IS NOT NULL AS claim_digest,
        to_regprocedure('public.claim_community_comment_push(integer)') IS NOT NULL AS claim_comment,
        public.online_challenge_day('2026-09-19T03:59:00+09:00'::timestamptz) = '2026-09-18'::date AS late_night_previous_day,
        public.online_challenge_day('2026-09-19T04:00:00+09:00'::timestamptz) = '2026-09-19'::date AS morning_new_day,
        position('(now() AT TIME ZONE ''Asia/Seoul'')::date' in pg_get_functiondef(
            'public.create_online_challenge_post(jsonb)'::regprocedure)) > 0 AS create_uses_literal_day,
        (SELECT count(*)::int FROM public.community_post_push_digests) AS digest_rows,
        (SELECT count(*)::int FROM public.community_comment_push_recipients) AS comment_queue_rows`)).rows[0];
    if (!schema.create_media || !schema.replace_media || !schema.claim_digest || !schema.claim_comment
        || !schema.late_night_previous_day || !schema.morning_new_day)
        throw new Error('Migration schema incomplete');
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ status: apply ? 'applied' : 'dry_run_passed', project, before, after, schema }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation',
        message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally { await client.end(); }
