import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
    CREATE ROLE authenticated;
    CREATE TABLE public.notices (
        id bigint PRIMARY KEY, is_challenge boolean, challenge_format text, community_enabled boolean,
        program_start_date date, program_end_date date
    );
    CREATE TABLE public.community_channels (id uuid PRIMARY KEY, source_notice_id bigint, status text);
    CREATE TABLE public.community_channel_posts (
        id uuid PRIMARY KEY, channel_id uuid, author_id uuid, content text,
        deleted_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz
    );
    CREATE TABLE public.online_challenge_missions (
        id uuid PRIMARY KEY, challenge_id bigint, is_active boolean,
        schedule_type text, fixed_date date, target_count integer
    );
    CREATE TABLE public.online_challenge_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenge_id bigint, mission_id uuid,
        participant_id uuid, post_id uuid UNIQUE, completion_date date, completion_key text,
        is_valid boolean DEFAULT true, invalidated_at timestamptz
    );
    CREATE UNIQUE INDEX online_submission_active_slot_idx
        ON public.online_challenge_submissions(mission_id, participant_id, completion_key) WHERE is_valid;
    CREATE TABLE public.notice_responses (notice_id bigint, user_id uuid, status text);
    CREATE TABLE public.challenge_completion_rewards (challenge_id bigint, participant_id uuid);
    CREATE TABLE public.test_awards (post_id uuid);
    CREATE FUNCTION public.is_current_profile(profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT profile_id::text = current_setting('test.profile_id', true) $$;
    CREATE FUNCTION public.try_award_online_challenge() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_awards VALUES (NEW.post_id); RETURN NEW; END $$;
`);

const migration = await readFile(new URL('../supabase/migrations/20260918020000_edit_online_challenge_post_category.sql', import.meta.url), 'utf8');
await db.exec(migration);

const author = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const stranger = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const channel = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const post = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const firstMission = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const secondMission = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
await db.exec(`
    SET test.profile_id = '${author}';
    INSERT INTO public.notices VALUES (1, true, 'ONLINE', true, current_date - 1, current_date + 1);
    INSERT INTO public.community_channels VALUES ('${channel}', 1, 'ACTIVE');
    INSERT INTO public.community_channel_posts (id, channel_id, author_id, content)
        VALUES ('${post}', '${channel}', '${author}', '자유 글');
    INSERT INTO public.online_challenge_missions VALUES
        ('${firstMission}', 1, true, 'FLEXIBLE', NULL, 2),
        ('${secondMission}', 1, true, 'FLEXIBLE', NULL, 2);
    INSERT INTO public.notice_responses VALUES (1, '${author}', 'JOIN');
`);

const edit = (content, missionId, editor = author) => db.query(
    'SELECT public.update_online_challenge_post($1::uuid, $2::uuid, $3::text, $4::uuid) AS result',
    [post, editor, content, missionId],
);
const currentSubmission = async () => {
    const result = await db.query('SELECT mission_id, is_valid FROM public.online_challenge_submissions WHERE post_id = $1', [post]);
    return result.rows[0];
};

await edit('미션 글', firstMission);
assert.equal((await currentSubmission()).mission_id, firstMission, 'free post becomes mission submission');
await edit('자유 글로 변경', null);
assert.equal((await currentSubmission()).is_valid, false, 'mission submission becomes invalid');
await edit('다시 미션 글', secondMission);
assert.deepEqual(await currentSubmission(), { mission_id: secondMission, is_valid: true }, 'invalid row is restored for a different mission');
const awards = await db.query('SELECT count(*)::int AS count FROM public.test_awards');
assert.equal(awards.rows[0].count, 1, 'reactivation invokes the completion hook');

await assert.rejects(edit('타인 수정', null, stranger), /본인 글만 수정/);
await db.exec(`INSERT INTO public.challenge_completion_rewards VALUES (1, '${author}')`);
await assert.rejects(edit('보상 확정 후 변경', null), /완료 보상이 확정/);
const unchanged = await db.query('SELECT content FROM public.community_channel_posts WHERE id = $1', [post]);
assert.equal(unchanged.rows[0].content, '다시 미션 글', 'failed edit rolls back post content');

await db.close();
console.log('Online challenge post category edits passed.');
