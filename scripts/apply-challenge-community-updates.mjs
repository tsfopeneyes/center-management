import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const expectedProject = 'erecqalsxoxrufggvmcc';
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== expectedProject) throw new Error('Unexpected linked Supabase project');

const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name))) {
    throw new Error('Linked production database credentials unavailable');
}

const names = [
    '20260918010000_require_challenge_application_for_channel_access.sql',
    '20260918020000_edit_online_challenge_post_category.sql',
];
const migrations = await Promise.all(names.map(name => readFile(`supabase/migrations/${name}`, 'utf8')));
const fingerprint = createHash('sha256').update(migrations.join('\n')).digest('hex');
const client = new pg.Client({
    host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'approved-challenge-community-updates',
});

const snapshot = async () => (await client.query(`SELECT
    (SELECT count(*)::int FROM public.notices) AS notices,
    (SELECT count(*)::int FROM public.notice_responses) AS responses,
    (SELECT count(*)::int FROM public.community_channel_posts) AS posts,
    (SELECT count(*)::int FROM public.online_challenge_submissions) AS submissions,
    (SELECT count(*)::int FROM public.challenge_completion_rewards) AS rewards,
    (SELECT count(*)::int FROM public.logs) AS logs`)).rows[0];

try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");

    const before = await snapshot();
    const accessImpact = (await client.query(`SELECT count(*)::int AS direct_members_without_application
        FROM public.community_channels c
        JOIN public.community_channel_members m ON m.channel_id = c.id
        WHERE c.source_notice_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.notice_responses nr
            WHERE nr.notice_id = c.source_notice_id AND nr.user_id = m.user_id AND nr.status = 'JOIN'
        )`)).rows[0];
    const editImpact = (await client.query(`SELECT
        count(*) FILTER (WHERE s.id IS NULL)::int AS free_posts,
        count(*) FILTER (WHERE s.is_valid)::int AS mission_posts,
        count(*) FILTER (WHERE s.id IS NOT NULL AND NOT s.is_valid)::int AS previously_invalidated_posts,
        count(*) FILTER (WHERE s.is_valid AND r.participant_id IS NOT NULL)::int AS reward_protected_posts
        FROM public.community_channel_posts p
        JOIN public.community_channels c ON c.id = p.channel_id
        JOIN public.notices n ON n.id = c.source_notice_id
        LEFT JOIN public.online_challenge_submissions s ON s.post_id = p.id
        LEFT JOIN public.challenge_completion_rewards r
          ON r.challenge_id = n.id AND r.participant_id = p.author_id
        WHERE p.deleted_at IS NULL AND n.is_challenge AND n.challenge_format = 'ONLINE' AND n.community_enabled`)).rows[0];

    for (const sql of migrations) await client.query(sql);
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Protected row counts changed');
    const created = (await client.query(`SELECT
        to_regprocedure('public.update_online_challenge_post(uuid,uuid,text,uuid)') IS NOT NULL AS edit_rpc,
        to_regprocedure('public.can_access_community_channel(uuid,uuid)') IS NOT NULL AS access_rpc,
        EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_award_online_challenge_on_edit'
            AND tgrelid = 'public.online_challenge_submissions'::regclass AND NOT tgisinternal) AS award_trigger`)).rows[0];
    if (!Object.values(created).every(Boolean)) throw new Error('Migration objects missing');

    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    console.log(JSON.stringify({ status: apply ? 'applied' : 'dry_run_passed', project,
        sha256: fingerprint, before, after, accessImpact, editImpact, created }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation', message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally {
    await client.end();
}
