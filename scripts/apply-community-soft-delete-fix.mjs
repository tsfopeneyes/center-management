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
const sql = await readFile('supabase/migrations/20260918040000_soft_delete_community_post.sql', 'utf8');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'community-soft-delete-policy-dry-run' });
const snapshot = async () => (await client.query(`SELECT
    (SELECT count(*)::int FROM public.community_channels) AS channels,
    (SELECT count(*)::int FROM public.community_channel_posts) AS posts,
    (SELECT count(*)::int FROM public.online_challenge_submissions) AS submissions,
    (SELECT count(*)::int FROM public.community_channel_comments) AS comments,
    (SELECT count(*)::int FROM public.logs) AS logs`)).rows[0];

try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const before = await snapshot();
    const existing = await client.query(`SELECT to_regprocedure('public.soft_delete_community_post(uuid)') IS NOT NULL AS present`);
    if (existing.rows[0].present) throw new Error('Soft-delete function already present; review before retrying');
    await client.query(sql);
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Existing row counts changed');
    const functionInfo = (await client.query(`SELECT p.prosecdef AS security_definer,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
        FROM pg_proc p WHERE p.oid = 'public.soft_delete_community_post(uuid)'::regprocedure`)).rows[0];
    if (!functionInfo?.security_definer || !functionInfo.authenticated_execute) throw new Error('Function permissions unexpected');
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ status: apply ? 'applied' : 'dry_run_passed', project,
        sha256: createHash('sha256').update(sql).digest('hex'), before, after, functionInfo }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation', message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally { await client.end(); }
