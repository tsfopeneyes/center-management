import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
    user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'community-push-readonly-diagnosis' });
const query = async sql => (await client.query(sql)).rows;
try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL ROLE postgres');
    const today = await query(`SELECT now() AS at_utc,
        now() AT TIME ZONE 'Asia/Seoul' AS at_kst,
        (now() AT TIME ZONE 'Asia/Seoul')::date AS local_date`);
    const digests = await query(`SELECT c.name AS channel, d.local_date, d.state,
        d.attempts, d.last_error_code, count(*)::int AS recipients,
        sum(cardinality(d.post_ids))::int AS queued_posts,
        sum(cardinality(d.comment_ids))::int AS queued_comments,
        min(d.next_attempt_at) AS earliest_due
      FROM public.community_post_push_digests d
      JOIN public.community_channels c ON c.id = d.channel_id
      WHERE d.local_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 1
      GROUP BY c.name, d.local_date, d.state, d.attempts, d.last_error_code
      ORDER BY d.local_date, c.name, d.state`);
    const posts = await query(`SELECT c.name AS channel,
        (p.created_at AT TIME ZONE 'Asia/Seoul')::date AS local_date,
        EXTRACT(HOUR FROM p.created_at AT TIME ZONE 'Asia/Seoul')::int AS local_hour,
        count(*)::int AS posts
      FROM public.community_channel_posts p
      JOIN public.community_channels c ON c.id = p.channel_id
      WHERE p.created_at >= now() - interval '2 days' AND p.deleted_at IS NULL
      GROUP BY c.name, local_date, local_hour ORDER BY local_date, local_hour`);
    const comments = await query(`SELECT c.name AS channel,
        (m.created_at AT TIME ZONE 'Asia/Seoul')::date AS local_date,
        EXTRACT(HOUR FROM m.created_at AT TIME ZONE 'Asia/Seoul')::int AS local_hour,
        count(*)::int AS comments
      FROM public.community_channel_comments m
      JOIN public.community_channel_posts p ON p.id = m.post_id
      JOIN public.community_channels c ON c.id = p.channel_id
      WHERE m.created_at >= now() - interval '2 days'
      GROUP BY c.name, local_date, local_hour ORDER BY local_date, local_hour`);
    const postQueue = await query(`SELECT r.state, r.attempts, r.last_error_code,
        count(*)::int AS recipients
      FROM public.community_post_push_recipients r
      GROUP BY r.state, r.attempts, r.last_error_code
      ORDER BY r.state, r.attempts`);
    const commentQueue = await query(`SELECT r.state, r.attempts, r.last_error_code,
        count(*)::int AS recipients
      FROM public.community_comment_push_recipients r
      GROUP BY r.state, r.attempts, r.last_error_code
      ORDER BY r.state, r.attempts`);
    const recentPosts = await query(`SELECT p.id, p.created_at,
        EXTRACT(HOUR FROM p.created_at AT TIME ZONE 'Asia/Seoul')::int AS local_hour,
        count(r.user_id)::int AS recipients,
        string_agg(DISTINCT r.state || ':' || coalesce(r.last_error_code, ''), ',') AS recipient_states
      FROM public.community_channel_posts p
      LEFT JOIN public.community_post_push_recipients r ON r.post_id = p.id
      WHERE p.created_at >= now() - interval '1 day'
      GROUP BY p.id, p.created_at ORDER BY p.created_at`);
    const jinRecipients = await query(`SELECT u.name, r.state, r.attempts, r.last_error_code,
        p.created_at AS post_created_at, count(d.id)::int AS enabled_devices,
        count(*) FILTER (WHERE d.provider='FCM')::int AS fcm_devices,
        count(*) FILTER (WHERE d.provider='WEB_PUSH')::int AS web_push_devices
      FROM public.community_post_push_recipients r
      JOIN public.users u ON u.id = r.user_id
      JOIN public.community_channel_posts p ON p.id = r.post_id
      LEFT JOIN public.push_devices d ON d.user_id = u.id AND d.enabled
      WHERE lower(u.name) = 'jin' AND p.created_at >= now() - interval '2 days'
      GROUP BY u.id, u.name, r.state, r.attempts, r.last_error_code, p.created_at
      ORDER BY p.created_at`);
    const midnightDelivery = await query(`SELECT p.created_at AS post_at,
        author.name AS author, recipient.name AS recipient,
        r.state, r.last_error_code, r.updated_at AS processed_at,
        r.next_attempt_at AS due_at,
        (SELECT count(*)::int FROM public.push_devices d
         WHERE d.user_id = r.user_id AND d.enabled) AS enabled_devices
      FROM public.community_post_push_recipients r
      JOIN public.community_channel_posts p ON p.id = r.post_id
      JOIN public.users author ON author.id = p.author_id
      JOIN public.users recipient ON recipient.id = r.user_id
      WHERE p.created_at >= '2026-09-18T15:00:00Z'::timestamptz
        AND p.created_at < '2026-09-18T16:00:00Z'::timestamptz
      ORDER BY p.created_at, recipient.name`);
    const likelyAccount = await query(`SELECT u.name, u.role, u.is_master,
        c.name AS channel, nr.status AS application_status,
        (SELECT count(*)::int FROM public.push_devices d
         WHERE d.user_id = u.id AND d.enabled) AS enabled_devices,
        (u.fcm_token IS NOT NULL AND length(trim(u.fcm_token)) > 0) AS legacy_token
      FROM public.users u
      CROSS JOIN public.community_channels c
      LEFT JOIN public.notice_responses nr
        ON nr.notice_id = c.source_notice_id AND nr.user_id = u.id
      WHERE lower(u.name) LIKE '%jin%' AND c.name = '하나님의 관심으로 일주일 살기'
      ORDER BY u.name`);
    const triggerState = await query(`SELECT t.tgenabled AS post_trigger_enabled,
        position('community_post_push_digests' IN pg_get_functiondef(t.tgfoid)) > 0 AS queues_digests
      FROM pg_trigger t WHERE t.tgname = 'trg_queue_community_post_push'
        AND t.tgrelid = 'public.community_channel_posts'::regclass`);
    const cron = await query(`SELECT jobname, active, schedule FROM cron.job
      WHERE jobname = 'recruitment-start-alerts'`);
    const cronRuns = await query(`SELECT status, count(*)::int AS runs,
        min(start_time) AS first_run, max(start_time) AS last_run
      FROM cron.job_run_details
      WHERE start_time >= ((now() AT TIME ZONE 'Asia/Seoul')::date + time '08:55')
          AT TIME ZONE 'Asia/Seoul'
        AND start_time < ((now() AT TIME ZONE 'Asia/Seoul')::date + time '09:15')
          AT TIME ZONE 'Asia/Seoul'
      GROUP BY status`);
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ today, digests, posts, comments, postQueue, commentQueue,
        recentPosts, jinRecipients, midnightDelivery, likelyAccount, triggerState, cron, cronRuns }));
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ code: error.code || 'diagnosis', message: error.message }));
    process.exitCode = 1;
} finally { await client.end(); }
