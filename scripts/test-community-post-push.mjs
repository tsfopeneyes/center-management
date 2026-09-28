import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260919010000_community_post_push.sql', import.meta.url), 'utf8');
await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE TABLE public.users (id uuid PRIMARY KEY);
  CREATE TABLE public.community_channels (id uuid PRIMARY KEY, name text, source_notice_id bigint, status text);
  CREATE TABLE public.notice_responses (notice_id bigint, user_id uuid, status text);
  CREATE TABLE public.community_channel_members (channel_id uuid, user_id uuid);
  CREATE TABLE public.community_channel_posts (
    id uuid PRIMARY KEY, channel_id uuid REFERENCES public.community_channels(id),
    author_id uuid REFERENCES public.users(id), is_hidden boolean DEFAULT false,
    deleted_at timestamptz
  );
`);
await db.exec(migration);
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const [author, joined, cancelled, another] = [1, 2, 3, 4].map(id);
const [challenge, standalone] = [11, 12].map(id);
await db.exec(`
  INSERT INTO public.users VALUES ('${author}'), ('${joined}'), ('${cancelled}'), ('${another}');
  INSERT INTO public.community_channels VALUES
    ('${challenge}', '챌린지', 91, 'ACTIVE'),
    ('${standalone}', '독립', NULL, 'ACTIVE');
  INSERT INTO public.notice_responses VALUES
    (91, '${joined}', 'JOIN'), (91, '${cancelled}', 'CANCEL'), (91, '${another}', 'JOIN');
  INSERT INTO public.community_channel_members VALUES
    ('${challenge}', '${cancelled}'),
    ('${standalone}', '${joined}'), ('${standalone}', '${cancelled}');
  INSERT INTO public.community_channel_posts (id, channel_id, author_id) VALUES
    ('${id(101)}', '${challenge}', '${author}'),
    ('${id(102)}', '${standalone}', '${author}');
`);
const recipients = (await db.query(`SELECT post_id, user_id FROM public.community_post_push_recipients
  ORDER BY post_id, user_id`)).rows;
assert.deepEqual(recipients, [
  { post_id: id(101), user_id: joined },
  { post_id: id(101), user_id: another },
  { post_id: id(102), user_id: joined },
  { post_id: id(102), user_id: cancelled },
]);
const claimed = (await db.query('SELECT post_id, user_id, state, attempts FROM public.claim_community_post_push(40)')).rows;
assert.equal(claimed.length, 4);
assert.ok(claimed.every(row => row.state === 'SENDING' && row.attempts === 1));
assert.equal((await db.query('SELECT count(*)::int AS n FROM public.claim_community_post_push(40)')).rows[0].n, 0);
await db.close();
console.log('Community push recipients and atomic claim passed.');
