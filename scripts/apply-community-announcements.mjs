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
const sql = await readFile('supabase/migrations/20260918030000_community_announcements_and_read_cursors.sql', 'utf8');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'approved-community-announcements-migration' });

const snapshot = async () => (await client.query(`SELECT
    (SELECT count(*)::int FROM public.community_channels) AS channels,
    (SELECT count(*)::int FROM public.community_channel_posts) AS posts,
    (SELECT count(*)::int FROM public.community_channel_comments) AS comments,
    (SELECT count(*)::int FROM public.notice_responses) AS applicants,
    (SELECT count(*)::int FROM public.logs) AS logs`)).rows[0];

try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const before = await snapshot();
    const existing = (await client.query(`SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
          AND table_name = 'community_channel_posts' AND column_name = 'is_announcement') AS announcement_column,
        to_regclass('public.community_channel_read_cursors') IS NOT NULL AS read_cursor_table`)).rows[0];
    if (existing.announcement_column || existing.read_cursor_table) throw new Error('Announcement migration already present or partially applied; review before retrying');

    await client.query(sql);
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Existing row counts changed');
    const created = (await client.query(`SELECT
        to_regprocedure('public.create_online_challenge_announcement(jsonb)') IS NOT NULL AS create_rpc,
        to_regprocedure('public.mark_community_channel_read(uuid,uuid,timestamptz)') IS NOT NULL AS read_rpc,
        to_regclass('public.community_channel_read_cursors') IS NOT NULL AS read_cursor_table,
        EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_community_announcement'
          AND tgrelid = 'public.community_channel_posts'::regclass AND NOT tgisinternal) AS announcement_guard`)).rows[0];
    if (!Object.values(created).every(Boolean)) throw new Error('Migration objects missing');
    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    console.log(JSON.stringify({ status: apply ? 'applied' : 'dry_run_passed', project,
        sha256: createHash('sha256').update(sql).digest('hex'), before, after, created }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation', message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally { await client.end(); }
