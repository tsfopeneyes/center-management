import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
    CREATE ROLE authenticated;
    CREATE TABLE public.users (id uuid PRIMARY KEY);
    CREATE TABLE public.community_channels (id uuid PRIMARY KEY);
    CREATE TABLE public.community_channel_posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id uuid, author_id uuid,
        content text, deleted_at timestamptz, created_at timestamptz DEFAULT now()
    );
    CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql STABLE
        AS $$ SELECT current_setting('test.staff', true) = 'true' $$;
    CREATE FUNCTION public.is_current_profile(profile_id uuid) RETURNS boolean LANGUAGE sql STABLE
        AS $$ SELECT profile_id::text = current_setting('test.profile_id', true) $$;
    CREATE FUNCTION public.can_access_community_channel(channel_id uuid) RETURNS boolean
        LANGUAGE sql STABLE AS $$ SELECT true $$;
    CREATE FUNCTION public.create_online_challenge_post(payload jsonb) RETURNS uuid
        LANGUAGE plpgsql AS $$
        DECLARE post_id uuid;
        BEGIN
            INSERT INTO public.community_channel_posts(channel_id, author_id, content)
            VALUES ((payload->>'channel_id')::uuid, (payload->>'author_id')::uuid, payload->>'content')
            RETURNING id INTO post_id;
            RETURN post_id;
        END $$;
`);

const migration = await readFile(new URL('../supabase/migrations/20260918030000_community_announcements_and_read_cursors.sql', import.meta.url), 'utf8');
await db.exec(migration);
const channel = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const author = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
await db.exec(`
    INSERT INTO public.users VALUES ('${author}');
    INSERT INTO public.community_channels VALUES ('${channel}');
    SET test.profile_id = '${author}';
    SET test.staff = 'true';
`);
const created = await db.query(`SELECT public.create_online_challenge_announcement($1::jsonb) AS id`,
    [JSON.stringify({ channel_id: channel, author_id: author, content: '공지 글' })]);
const postId = created.rows[0].id;
const pinned = await db.query('SELECT is_announcement, announced_at FROM public.community_channel_posts WHERE id = $1', [postId]);
assert.equal(pinned.rows[0].is_announcement, true);
assert.ok(pinned.rows[0].announced_at);

await db.exec(`SET test.staff = 'false'`);
await assert.rejects(db.query('UPDATE public.community_channel_posts SET is_announcement = false WHERE id = $1', [postId]), /관리자만/);
await assert.rejects(db.query('INSERT INTO public.community_channel_posts(channel_id,author_id,content,is_announcement) VALUES ($1,$2,$3,true)',
    [channel, author, '무단 공지']), /관리자만/);

await db.query('SELECT public.mark_community_channel_read($1::uuid,$2::uuid,$3::timestamptz)',
    [channel, author, '2026-09-18T01:00:00Z']);
await db.query('SELECT public.mark_community_channel_read($1::uuid,$2::uuid,$3::timestamptz)',
    [channel, author, '2026-09-17T01:00:00Z']);
const cursor = await db.query('SELECT last_read_at FROM public.community_channel_read_cursors WHERE channel_id = $1 AND user_id = $2', [channel, author]);
assert.equal(new Date(cursor.rows[0].last_read_at).toISOString(), '2026-09-18T01:00:00.000Z');

await db.close();
console.log('Community announcements and read cursors passed.');
