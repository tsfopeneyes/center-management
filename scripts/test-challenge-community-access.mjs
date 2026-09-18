import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA account_security;
    CREATE TABLE public.community_channels (
        id uuid PRIMARY KEY, name text, description text, source_notice_id bigint, channel_type text, status text
    );
    CREATE TABLE public.notices (
        id bigint PRIMARY KEY, title text, is_challenge boolean, challenge_format text, community_enabled boolean
    );
    CREATE TABLE public.notice_responses (
        notice_id bigint, user_id uuid, status text
    );
    CREATE TABLE public.community_channel_members (
        channel_id uuid, user_id uuid
    );
    CREATE FUNCTION account_security.current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.profile_id', true), '')::uuid $$;
    CREATE FUNCTION public.is_current_staff() RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT current_setting('test.staff', true) = 'true' $$;
`);

const migration = await readFile(new URL('../supabase/migrations/20260918010000_require_challenge_application_for_channel_access.sql', import.meta.url), 'utf8');
await db.exec(migration);

const profile = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const challenge = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const standalone = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
await db.exec(`
    INSERT INTO public.notices VALUES (1, '챌린지', true, 'ONLINE', true);
    INSERT INTO public.community_channels VALUES
      ('${challenge}', '챌린지', '', 1, 'CHALLENGE', 'ACTIVE'),
      ('${standalone}', '모임', '', NULL, 'PRIVATE', 'ACTIVE');
    INSERT INTO public.community_channel_members VALUES
      ('${challenge}', '${profile}'), ('${standalone}', '${profile}');
    SET test.profile_id = '${profile}';
    SET test.staff = 'false';
`);

const canAccess = async channelId => {
    const result = await db.query('SELECT public.can_access_community_channel($1::uuid) AS allowed', [channelId]);
    return result.rows[0].allowed;
};

assert.equal(await canAccess(challenge), false, 'a direct member without an application cannot enter a challenge');
assert.equal(await canAccess(standalone), true, 'a direct member can enter a standalone channel');
const participantCount = async channelId => {
    const result = await db.query('SELECT participant_count FROM public.get_community_invite_preview($1::uuid)', [channelId]);
    return result.rows[0].participant_count;
};
assert.equal(await participantCount(challenge), 0, 'hosts and direct members are not counted as applicants');
assert.equal(await participantCount(standalone), 1, 'standalone direct members are counted');
await db.exec(`INSERT INTO public.notice_responses VALUES (1, '${profile}', 'JOIN')`);
assert.equal(await canAccess(challenge), true, 'an approved applicant can enter a challenge');
assert.equal(await participantCount(challenge), 1, 'an approved applicant is counted');
await db.exec(`UPDATE public.notice_responses SET status = 'CANCEL'`);
assert.equal(await canAccess(challenge), false, 'cancelling the application revokes challenge access');
assert.equal(await participantCount(challenge), 0, 'a cancelled application is not counted');
await db.exec(`SET test.staff = 'true'`);
assert.equal(await canAccess(challenge), true, 'staff can moderate a challenge');

await db.close();
console.log('Community access migration checks passed.');
