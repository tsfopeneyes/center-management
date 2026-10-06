import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

// Isolated PostgreSQL engine only: no network, credentials, or production rows.
const db = await (async () => {
    if (!process.argv.includes('--real-postgres')) return new PGlite();
    const client = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'postgres',
        database: 'codex_session_20260929', connectionTimeoutMillis: 3000,
        application_name: 'codex-isolated-session-boundary-test' });
    await client.connect();
    return { exec: sql => client.query(sql), query: (sql, params) => client.query(sql, params),
        close: () => client.end() };
})();
const isPermissionDenied = error => error.code === '42501'
    || /row-level security|permission denied/i.test(error.message);
const members = Array.from({ length: 5 }, () => crypto.randomUUID());
const sessionId = crypto.randomUUID();
const closedSessionId = crypto.randomUUID();
const guestId = crypto.randomUUID();
const secondGuestId = crypto.randomUUID();

const applySql = async (path) => db.exec(readFileSync(new URL(path, import.meta.url), 'utf8'));
const asMember = async (id) => db.query("SELECT set_config('test.member_id', $1, false)", [id]);
const submit = async (id, action, session = sessionId) => {
    await asMember(id);
    return (await db.query(`INSERT INTO public.member_program_session_applications
        (session_id, user_id, action) VALUES ($1, $2, $3) RETURNING status`,
    [session, id, action])).rows[0].status;
};
const row = async (id) => (await db.query(`SELECT status,is_attended,application_answers
    FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2`,
[sessionId, id])).rows[0];

try {
    await db.exec(`
        DO $roles$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        END $roles$;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
            SELECT NULLIF(current_setting('test.member_id', true), '')::uuid
        $$;
        CREATE FUNCTION public.calendar_is_admin() RETURNS boolean LANGUAGE sql AS $$
            SELECT COALESCE(current_setting('test.admin', true), 'false') = 'true'
        $$;
        CREATE TABLE public.users (
            id uuid PRIMARY KEY, auth_user_id uuid, name text, phone text, birth text,
            user_group text, role text, status text, is_leader boolean DEFAULT false,
            preferences jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE TABLE public.notices (
            id bigint PRIMARY KEY, category text, is_recruiting boolean,
            is_challenge boolean, guest_properties jsonb, program_status text,
            is_leader_only boolean DEFAULT false
        );
        CREATE TABLE public.notice_responses (
            id bigint PRIMARY KEY, notice_id bigint, user_id uuid, status text,
            application_answers jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        GRANT SELECT ON public.users TO authenticated;
    `);
    for (const filename of [
        '20260907050000_daily_open_program_sessions.sql',
        '20260907060000_generalize_daily_program_sessions.sql',
        '20260908030000_add_daily_session_fields.sql',
        '20260908040000_add_daily_session_voiding.sql',
        '20260917010000_admin_daily_program_walk_in_insert.sql',
    ]) await applySql(`../supabase/migrations/${filename}`);
    await applySql('../supabase/manual/proposals/20260910_guest_daily_applications.sql');
    await applySql('../supabase/manual/proposals/20260911_recurring_session_applications.sql');

    for (const [index, id] of members.entries()) {
        await db.query('INSERT INTO public.users (id,auth_user_id,name,phone,birth,user_group,role,status) VALUES ($1,$1,$2,NULL,NULL,$3,$4,$5)',
            [id, `테스트 회원 ${index + 1}`, '청소년', 'user', 'approved']);
    }
    await db.query(`INSERT INTO public.users (id,auth_user_id,name,phone,birth,user_group,role,status) VALUES
        ($1,NULL,'테스트 게스트','010-1234-5678','080315','게스트','student','approved')`, [guestId]);
    await db.exec(`INSERT INTO public.notices (id,category,is_recruiting,is_challenge,guest_properties,program_status) VALUES (
        1, 'PROGRAM', true, false,
        '{"schedule_mode":"RECURRING","application_scope":"SESSION","allow_guest":true}', 'ACTIVE'
    )`);
    await db.query(`INSERT INTO public.daily_program_sessions
        (id, notice_id, session_date, starts_at, session_summary, capacity)
        VALUES ($1, 1, (now() AT TIME ZONE 'Asia/Seoul')::date + 1,
            now() + interval '1 day', '테스트 회차', 1)`, [sessionId]);
    await db.query(`INSERT INTO public.daily_program_sessions
        (id, notice_id, session_date, starts_at, session_summary, capacity, status)
        VALUES ($1, 1, (now() AT TIME ZONE 'Asia/Seoul')::date + 2,
            now() + interval '2 days', '닫힌 회차', 1, 'CLOSED')`, [closedSessionId]);

    // Existing records, including answers and attendance, must survive DDL unchanged.
    await db.query(`INSERT INTO public.daily_program_session_responses
        (session_id,user_id,status,is_attended,application_answers)
        VALUES ($1,$2,'JOIN',true,'{"kept":"yes"}')`, [sessionId, members[0]]);
    const before = await row(members[0]);
    await applySql('../supabase/manual/proposals/20260929_member_session_write_boundary.sql');
    assert.deepEqual(await row(members[0]), before);

    await db.exec('SET ROLE authenticated');
    assert.equal(await submit(members[1], 'JOIN'), 'WAITLIST');
    assert.equal(await submit(members[2], 'JOIN'), 'WAITLIST');
    assert.equal(await submit(members[1], 'JOIN'), 'WAITLIST');
    assert.deepEqual((await db.query('SELECT * FROM public.member_program_session_applications')).rows, []);
    await asMember(members[3]);
    await assert.rejects(db.query(`INSERT INTO public.daily_program_session_responses
        (session_id,user_id,status) VALUES ($1,$2,'JOIN')`, [sessionId, members[3]]),
    isPermissionDenied);
    const bypassUpdate = await db.query(`UPDATE public.daily_program_session_responses
        SET status='JOIN' WHERE session_id=$1 AND user_id=$2 RETURNING user_id`, [sessionId, members[1]]);
    assert.equal(bypassUpdate.rows.length, 0);
    await assert.rejects(submit(members[3], 'JOIN', closedSessionId), /마감/);
    await assert.rejects(submit(members[3], 'INVALID'), /Invalid application action/);
    await asMember(members[3]);
    await assert.rejects(db.query(`INSERT INTO public.member_program_session_applications
        (session_id,user_id,action) VALUES($1,$2,'JOIN')`, [sessionId, members[4]]), /신청자/);
    assert.equal(await submit(members[0], 'CANCEL'), 'CANCELLED');
    assert.equal(await submit(members[0], 'CANCEL'), 'CANCELLED');
    assert.equal(await submit(members[1], 'JOIN'), 'JOIN');
    assert.equal(await submit(members[0], 'JOIN'), 'WAITLIST');

    await db.exec('RESET ROLE');
    assert.equal((await row(members[1])).status, 'JOIN');
    assert.equal((await row(members[2])).status, 'WAITLIST');
    assert.equal((await row(members[0])).application_answers.kept, 'yes');
    assert.equal((await row(members[0])).is_attended, true);
    assert.equal((await db.query('SELECT join_count FROM public.daily_program_sessions WHERE id=$1', [sessionId])).rows[0].join_count, 1);

    // Staff direct-table operations remain valid under their separate policies.
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT set_config('test.admin', 'true', false)");
    await db.query(`INSERT INTO public.daily_program_session_responses
        (session_id,user_id,status,is_attended) VALUES($1,$2,'WAITLIST',true)`, [sessionId, members[4]]);
    await db.query(`UPDATE public.daily_program_session_responses SET is_attended=false
        WHERE session_id=$1 AND user_id=$2`, [sessionId, members[4]]);
    await db.exec('RESET ROLE');
    assert.equal((await row(members[4])).is_attended, false);

    // Guest RPC is a separate guarded path and must remain usable.
    await db.exec('SET ROLE anon');
    const guestResult = await db.query(`SELECT public.apply_guest_program_session(
        $1,$2,'테스트 게스트','010-1234-5678','080315','{}'::jsonb) AS result`, [sessionId, guestId]);
    assert.equal(guestResult.rows[0].result.status, 'WAITLIST');
    await assert.rejects(db.query('SELECT * FROM public.member_program_session_applications'), isPermissionDenied);
    await db.exec('RESET ROLE');

    const form = { questions: [
        { id: 'member_school', label: '학교', type: 'text', required: true, audience: 'MEMBER', options: [] },
        { id: 'guest_gender', label: '성별', type: 'select', required: true, audience: 'GUEST', options: ['여', '남'] },
    ] };
    await applySql('../supabase/manual/proposals/20260929_application_form_snapshots.sql');
    await applySql('../supabase/manual/proposals/20260929_session_application_attempt_history.sql');
    await applySql('../supabase/manual/proposals/20260930_program_application_audience.sql');
    await applySql('../supabase/manual/proposals/20260930_program_application_audience_classification.sql');
    await applySql('../supabase/manual/proposals/20260930_program_application_audience_write_guard.sql');
    await db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify(form)]);
    const historical = await row(members[0]);
    await applySql('../supabase/manual/proposals/20260929_session_application_answers.sql');
    await applySql('../supabase/manual/proposals/20260930_program_application_revision_guard.sql');
    await applySql('../supabase/manual/proposals/20260930_checked_program_session_requests.sql');
    assert.deepEqual(await row(members[0]), historical);
    await db.exec('UPDATE public.notices SET is_leader_only=true WHERE id=1');
    await db.exec('SET ROLE authenticated');
    await asMember(members[3]);
    await assert.rejects(db.query(`SELECT public.respond_to_program_session($1,$2,'JOIN','{"member_school":"하이픈중"}'::jsonb)`,
        [sessionId, members[3]]), /리더만/);
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query(`SELECT public.apply_guest_program_session(
        $1,$2,'테스트 게스트','010-1234-5678','080315','{}'::jsonb)`, [sessionId, guestId]), /리더만/);
    await db.exec('RESET ROLE');
    await db.exec('UPDATE public.notices SET is_leader_only=false WHERE id=1');
    await db.query(`INSERT INTO public.users (id,auth_user_id,name,phone,birth,user_group,role,status) VALUES
        ($1,NULL,'두 번째 게스트','010-1234-5678','080315','게스트','student','approved')`, [secondGuestId]);

    await db.exec('SET ROLE authenticated');
    await asMember(members[3]);
    const memberWithAnswers = (answers, revision = 1) => db.query(`INSERT INTO public.member_program_session_checked_requests
        (session_id,user_id,action,application_answers,expected_revision)
        VALUES($1,$2,'JOIN',$3::jsonb,$4) RETURNING status`,
    [sessionId, members[3], JSON.stringify(answers), revision]);
    await assert.rejects(memberWithAnswers({ member_school: '하이픈중' }, 0), /질문이 변경/);
    await assert.rejects(memberWithAnswers({}), /Required application answer/);
    await assert.rejects(memberWithAnswers({ guest_gender: '남' }), /does not belong/);
    assert.equal((await memberWithAnswers({ member_school: '하이픈중' })).rows[0].status, 'WAITLIST');
    await asMember(members[1]);
    assert.equal((await db.query(`SELECT public.respond_to_program_session($1,$2,'JOIN') AS result`,
        [sessionId, members[1]])).rows[0].result.status, 'JOIN');
    await db.exec('RESET ROLE');
    const memberSnapshot = (await db.query(`SELECT application_form_revision,application_form_snapshot,application_answers,application_audience
        FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2`,
    [sessionId, members[3]])).rows[0];
    assert.equal(memberSnapshot.application_form_revision, 1);
    assert.deepEqual(memberSnapshot.application_form_snapshot, form);
    assert.equal(memberSnapshot.application_answers.member_school, '하이픈중');
    assert.equal(memberSnapshot.application_audience, 'MEMBER');

    await db.exec('SET ROLE authenticated');
    await asMember(members[3]);
    assert.equal((await db.query(`SELECT public.respond_to_program_session(
        $1,$2,'CANCEL','{}'::jsonb) AS result`, [sessionId, members[3]])).rows[0].result.status, 'CANCELLED');
    assert.equal((await row(members[3])).application_answers.member_school, '하이픈중');
    assert.equal((await memberWithAnswers({ member_school: '다른학교' })).rows[0].status, 'WAITLIST');
    await assert.rejects(db.query('SELECT id FROM public.program_session_application_attempt_history'), isPermissionDenied);
    await db.exec('RESET ROLE');
    assert.equal((await row(members[3])).application_answers.member_school, '다른학교');
    const priorSessionAttempt = (await db.query(`SELECT status,application_answers,
        application_form_revision,application_form_snapshot,application_audience
        FROM public.program_session_application_attempt_history
        WHERE session_id=$1 AND user_id=$2`, [sessionId, members[3]])).rows;
    assert.equal(priorSessionAttempt.length, 1);
    assert.equal(priorSessionAttempt[0].status, 'CANCELLED');
    assert.equal(priorSessionAttempt[0].application_answers.member_school, '하이픈중');
    assert.equal(priorSessionAttempt[0].application_form_revision, 1);
    assert.deepEqual(priorSessionAttempt[0].application_form_snapshot, form);
    assert.equal(priorSessionAttempt[0].application_audience, 'MEMBER');

    await db.exec('SET ROLE anon');
    await assert.rejects(db.query(`INSERT INTO public.guest_program_session_applications
        (session_id,user_id,name,phone,birth,application_answers)
        VALUES($1,$2,'두 번째 게스트','010-1234-5678','080315','{}'::jsonb)`,
    [sessionId, secondGuestId]), /Required application answer/);
    assert.equal((await db.query(`INSERT INTO public.guest_program_session_applications
        (session_id,user_id,name,phone,birth,application_answers)
        VALUES($1,$2,'두 번째 게스트','010-1234-5678','080315','{"guest_gender":"여"}'::jsonb)
        RETURNING status`, [sessionId, secondGuestId])).rows[0].status, 'WAITLIST');
    await db.exec('RESET ROLE');
    const guestSnapshot = (await db.query(`SELECT application_form_revision,application_form_snapshot,application_answers,application_audience
        FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2`,
    [sessionId, secondGuestId])).rows[0];
    assert.equal(guestSnapshot.application_form_revision, 1);
    assert.deepEqual(guestSnapshot.application_form_snapshot, form);
    assert.equal(guestSnapshot.application_answers.guest_gender, '여');
    assert.equal(guestSnapshot.application_audience, 'GUEST');

    await db.exec(`ALTER TABLE public.users
        ADD COLUMN gender text, ADD COLUMN school text, ADD COLUMN phone_back4 text,
        ADD COLUMN guardian_name text, ADD COLUMN guardian_phone text,
        ADD COLUMN guardian_relation text, ADD COLUMN IF NOT EXISTS preferences jsonb,
        ADD COLUMN password text, ADD COLUMN memo text`);
    await db.exec(`CREATE FUNCTION public.program_application_transition(bigint,uuid,text,text,jsonb)
        RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"status":"JOIN"}'::jsonb $$`);
    await applySql('../supabase/manual/proposals/20260929_atomic_guest_program_registration.sql');
    await applySql('../supabase/manual/proposals/20260930_checked_guest_program_registration.sql');
    const atomicProfile = JSON.stringify({
        name: '신규 회차 비회원', school: '테스트 학교', phone: '010-9876-5432',
        birth_date: '2008-03-15', privacy_consent: true,
    });
    const beforeAtomicFailure = (await db.query('SELECT count(*)::integer AS count FROM public.users')).rows[0].count;
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query(`SELECT public.register_guest_program_application_checked(
        NULL,$1,$2::jsonb,'{"guest_gender":"여"}'::jsonb,0)`, [sessionId, atomicProfile]), /질문이 변경/);
    await assert.rejects(db.query(`SELECT public.register_guest_program_application_checked(
        NULL,$1,$2::jsonb,'{}'::jsonb,1)`, [sessionId, atomicProfile]), /Required application answer/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.users')).rows[0].count,
        beforeAtomicFailure, 'invalid session answer leaves no guest account');
    await db.exec('SET ROLE anon');
    const atomic = (await db.query(`INSERT INTO public.guest_program_registration_checked_requests
        (session_id,profile,application_answers,expected_revision)
        VALUES($1,$2::jsonb,'{"guest_gender":"여"}'::jsonb,1)
        RETURNING status,user_id`, [sessionId, atomicProfile])).rows[0];
    await db.exec('RESET ROLE');
    assert.equal(atomic.status, 'WAITLIST');
    const atomicResponse = (await db.query(`SELECT application_answers,application_form_snapshot
        FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2`,
    [sessionId, atomic.user_id])).rows[0];
    assert.equal(atomicResponse.application_answers.guest_gender, '여');
    assert.deepEqual(atomicResponse.application_form_snapshot, form);

    await db.query(`SELECT public.program_session_transition($1,$2,'CANCEL','GUEST','{}'::jsonb)`,
        [sessionId, secondGuestId]);
    await db.query("UPDATE public.users SET user_group='청소년',auth_user_id=id WHERE id=$1", [secondGuestId]);
    assert.equal((await db.query('SELECT application_audience FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2',
        [sessionId, secondGuestId])).rows[0].application_audience, 'GUEST');
    await db.exec('SET ROLE authenticated');
    await asMember(secondGuestId);
    assert.equal((await db.query(`SELECT public.respond_to_program_session($1,$2,'JOIN','{"member_school":"새 학교"}'::jsonb) AS result`,
        [sessionId, secondGuestId])).rows[0].result.status, 'WAITLIST');
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT application_audience FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2',
        [sessionId, secondGuestId])).rows[0].application_audience, 'MEMBER');
    assert.equal((await db.query('SELECT application_audience FROM public.program_session_application_attempt_history WHERE session_id=$1 AND user_id=$2',
        [sessionId, secondGuestId])).rows[0].application_audience, 'GUEST');

    console.log('PASS: member/guest session answers and snapshots, RPC relation fallback, capacity, promotion, identity, old signature, member write denial, staff edits, preserved history. Isolated database only.');
} finally {
    await db.close();
}
