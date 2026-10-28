import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import pg from 'pg';

export const communityProject = 'erecqalsxoxrufggvmcc';
export async function connectCommunityDb({ cliPath } = {}) {
    if ((await readFile('supabase/.temp/project-ref', 'utf8')).trim() !== communityProject)
        throw new Error('Unexpected linked project');
    const dry = execFileSync(cliPath || process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        cliPath ? ['db', 'dump', '--linked', '--schema', 'public', '--dry-run'] : ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000, timeout: 30000 });
    const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
    if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name)))
        throw new Error('Linked database credentials unavailable');
    const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
        user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
        ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
        connectionTimeoutMillis: 15000, application_name: 'program-community-reviewed-migration' });
    await client.connect();
    return client;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/community-db.mjs')) {
    const db = await connectCommunityDb();
    try {
        await db.query('BEGIN READ ONLY');
        await db.query('SET LOCAL ROLE postgres');
        const { rows: channels } = await db.query(`SELECT c.id,c.name,c.source_notice_id,c.status,
            n.category,n.is_challenge,n.challenge_format,n.is_recruiting,n.recruitment_start_at,
            (SELECT count(*) FROM public.community_channel_members m WHERE m.channel_id=c.id) AS direct_members
            FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id ORDER BY c.created_at`);
        const { rows: policies } = await db.query(`SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies
            WHERE schemaname='public' AND tablename IN ('community_channels','community_channel_members',
            'community_channel_posts','community_channel_comments','daily_program_session_responses','open_program_attendance')`);
        const { rows: functions } = await db.query(`SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS definition
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN
            ('sync_notice_community_channel','detach_notice_community_channel','link_community_channel_to_notice',
            'can_access_community_channel','queue_community_post_push','is_joinable_standalone_channel','create_online_challenge_post',
            'get_community_invite_preview','queue_community_comment_push','update_online_challenge_post','replace_community_post_media')`);
        const { rows: triggers } = await db.query(`SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger
            WHERE NOT tgisinternal AND tgname IN ('trg_sync_notice_community_channel','trg_detach_notice_community_channel')`);
        await mkdir('artifacts/program-community', { recursive: true });
        await writeFile('artifacts/program-community/before.json', JSON.stringify({ project: communityProject, channels, policies, functions, triggers }, null, 2));
        await db.query('ROLLBACK');
        console.log(JSON.stringify({ project: communityProject, channels, policies: policies.length, functions: functions.map(f => f.signature), triggers }));
    } finally { await db.end(); }
}
