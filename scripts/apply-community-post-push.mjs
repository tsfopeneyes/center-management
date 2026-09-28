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
const sql = await readFile('supabase/migrations/20260919010000_community_post_push.sql', 'utf8');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'community-post-push-impact-check' });
const snapshot = async () => (await client.query(`SELECT
    (SELECT count(*)::int FROM public.community_channels) AS channels,
    (SELECT count(*)::int FROM public.community_channel_posts) AS posts,
    (SELECT count(*)::int FROM public.community_channel_members) AS members,
    (SELECT count(*)::int FROM public.notice_responses) AS applicants,
    (SELECT count(*)::int FROM public.logs) AS logs`)).rows[0];

try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const before = await snapshot();
    const scheduled = (await client.query(`SELECT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'recruitment-start-alerts' AND active
    ) AS worker_active`)).rows[0];
    if (!scheduled.worker_active) throw new Error('Existing minute worker is not active');
    const existing = (await client.query(`SELECT to_regclass('public.community_post_push_recipients') IS NOT NULL AS present`)).rows[0];
    if (existing.present) throw new Error('Community push queue already exists; review before retrying');
    await client.query(sql);
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Existing row counts changed');
    const objects = (await client.query(`SELECT
      to_regclass('public.community_post_push_recipients') IS NOT NULL AS queue,
      to_regprocedure('public.claim_community_post_push(integer)') IS NOT NULL AS claim_rpc,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_queue_community_post_push'
        AND tgrelid = 'public.community_channel_posts'::regclass AND NOT tgisinternal) AS post_trigger,
      (SELECT count(*)::int FROM public.community_post_push_recipients) AS queued_rows`)).rows[0];
    if (!objects.queue || !objects.claim_rpc || !objects.post_trigger || objects.queued_rows !== 0)
        throw new Error('Queue migration objects unexpected');
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ status: apply ? 'applied' : 'dry_run_passed', project,
        sha256: createHash('sha256').update(sql).digest('hex'), before, after,
        workerActive: scheduled.worker_active, objects }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation',
        message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally { await client.end(); }
