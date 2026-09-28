import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = async name => db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.users (id uuid PRIMARY KEY);
CREATE TABLE public.community_channels (id uuid PRIMARY KEY, name text, source_notice_id bigint, status text);
CREATE TABLE public.notice_responses (notice_id bigint, user_id uuid, status text);
CREATE TABLE public.community_channel_members (channel_id uuid, user_id uuid);
CREATE TABLE public.community_channel_posts (
 id uuid PRIMARY KEY, channel_id uuid REFERENCES public.community_channels(id),
 author_id uuid REFERENCES public.users(id), is_hidden boolean DEFAULT false,
 deleted_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.community_channel_comments (
 id uuid PRIMARY KEY, post_id uuid REFERENCES public.community_channel_posts(id),
 user_id uuid REFERENCES public.users(id), is_hidden boolean DEFAULT false,
 created_at timestamptz DEFAULT now()
);
`);
await migration('20260919010000_community_post_push.sql');
await migration('20260919030000_community_morning_digest.sql');
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const [author, joined] = [1, 2].map(id);
const channel = id(11);
await db.exec(`
INSERT INTO public.users VALUES ('${author}'), ('${joined}');
INSERT INTO public.community_channels VALUES ('${channel}', '챌린지', 91, 'ACTIVE');
INSERT INTO public.notice_responses VALUES (91, '${joined}', 'JOIN'), (91, '${author}', 'JOIN');
INSERT INTO public.community_channel_posts(id,channel_id,author_id,created_at) VALUES
 ('${id(101)}','${channel}','${author}','2026-09-18T15:10:00Z'),
 ('${id(102)}','${channel}','${author}','2026-09-18T16:10:00Z');
INSERT INTO public.community_channel_comments(id,post_id,user_id,created_at) VALUES
 ('${id(201)}','${id(101)}','${joined}','2026-09-18T17:10:00Z');
`);
const overnight = (await db.query('SELECT channel_id,user_id,post_ids,comment_ids,state FROM public.community_post_push_digests ORDER BY user_id')).rows;
assert.equal(overnight.length, 2, 'one digest for each recipient and community');
const joinedDigest = overnight.find(row => row.user_id === joined);
assert.deepEqual(joinedDigest.post_ids, [id(101), id(102)]);
assert.deepEqual(joinedDigest.comment_ids, []);
const authorDigest = overnight.find(row => row.user_id === author);
assert.deepEqual(authorDigest.post_ids, []);
assert.deepEqual(authorDigest.comment_ids, [id(201)]);
assert.equal((await db.query('SELECT count(*)::int AS n FROM public.community_post_push_recipients')).rows[0].n, 0);
await db.exec(`
INSERT INTO public.community_channel_posts(id,channel_id,author_id,created_at) VALUES
 ('${id(103)}','${channel}','${author}','2026-09-19T00:10:00Z');
INSERT INTO public.community_channel_comments(id,post_id,user_id,created_at) VALUES
 ('${id(202)}','${id(101)}','${joined}','2026-09-19T00:11:00Z');
`);
assert.equal((await db.query('SELECT count(*)::int AS n FROM public.community_post_push_recipients')).rows[0].n, 1);
assert.equal((await db.query('SELECT count(*)::int AS n FROM public.community_comment_push_recipients')).rows[0].n, 1);
await db.close();
console.log('Midnight posts and comments coalesce into one digest; daytime items queue separately.');
