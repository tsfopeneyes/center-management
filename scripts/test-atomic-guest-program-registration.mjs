import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL engine: no network, production credentials, or live rows.
const db = new PGlite();
const proposal = readFileSync(new URL('../supabase/manual/proposals/20260929_atomic_guest_program_registration.sql', import.meta.url), 'utf8');
const profile = (phone, extras = {}) => ({
    name: '테스트 비회원', school: '테스트 학교', phone,
    birth_date: '2008-03-15', privacy_consent: true,
    ...extras,
});
const register = (noticeId, sessionId, guestProfile, answers = {}) => db.query(`
    SELECT public.register_guest_program_application(
        $1::bigint,$2::uuid,$3::jsonb,$4::jsonb
    ) AS result
`, [noticeId, sessionId, JSON.stringify(guestProfile), JSON.stringify(answers)]);
const countUsers = async () => Number((await db.query('SELECT count(*) AS count FROM public.users')).rows[0].count);
const userByPhone = async phone => (await db.query('SELECT * FROM public.users WHERE phone=$1', [phone])).rows[0];

try {
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE TABLE public.users (
            id uuid PRIMARY KEY, name text, gender text, school text, birth text,
            phone text, phone_back4 text, guardian_name text, guardian_phone text,
            guardian_relation text, preferences jsonb, user_group text,
            password text, role text, status text, memo text
        );
        CREATE TABLE public.notice_responses (
            notice_id bigint, user_id uuid, status text,
            PRIMARY KEY(notice_id,user_id)
        );
        CREATE TABLE public.daily_program_session_responses (
            session_id uuid, user_id uuid, status text,
            PRIMARY KEY(session_id,user_id)
        );
        CREATE FUNCTION public.program_application_transition(
            p_notice_id bigint, p_user_id uuid, p_action text,
            p_audience text, p_answers jsonb
        ) RETURNS jsonb LANGUAGE plpgsql AS $$
        DECLARE v_status text;
        BEGIN
            IF p_notice_id = 9 THEN RETURN '{}'::jsonb; END IF;
            IF p_notice_id <> 1 OR p_answers->>'fail' = 'yes' THEN
                RAISE EXCEPTION 'application rejected';
            END IF;
            INSERT INTO public.notice_responses VALUES (p_notice_id,p_user_id,'JOIN')
                ON CONFLICT DO NOTHING;
            SELECT status INTO v_status FROM public.notice_responses
                WHERE notice_id=p_notice_id AND user_id=p_user_id;
            RETURN jsonb_build_object('status',v_status);
        END;
        $$;
        CREATE FUNCTION public.program_session_transition(
            p_session_id uuid, p_user_id uuid, p_action text,
            p_audience text, p_answers jsonb
        ) RETURNS jsonb LANGUAGE plpgsql AS $$
        BEGIN
            IF p_answers->>'fail' = 'yes' THEN
                RAISE EXCEPTION 'session rejected';
            END IF;
            INSERT INTO public.daily_program_session_responses VALUES (p_session_id,p_user_id,'WAITLIST')
                ON CONFLICT DO NOTHING;
            RETURN jsonb_build_object('status','WAITLIST');
        END;
        $$;
    `);
    await db.exec(proposal);

    const first = (await register(1, null, profile('010-1111-2222'))).rows[0].result;
    assert.equal(first.status, 'JOIN');
    assert.equal(first.had_prior_guest_applications, false);
    assert.equal(first.guest_user.id, first.user_id);
    assert.equal(first.guest_user.phone, '010-1111-2222');
    assert.equal(first.guest_user.preferences.guest_birth_consent.guardian_consent, false);
    assert.equal(Object.hasOwn(first.guest_user, 'password'), false);
    assert.equal(await countUsers(), 1);

    const second = (await register(1, null, profile('01011112222'))).rows[0].result;
    assert.equal(second.user_id, first.user_id);
    assert.equal(second.had_prior_guest_applications, true);
    assert.equal(await countUsers(), 1);
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM public.notice_responses')).rows[0].count), 1);

    await assert.rejects(register(1, null, profile('010-3333-4444'), { fail: 'yes' }), /application rejected/);
    assert.equal(await countUsers(), 1, 'a failed application must roll back new guest creation');
    await assert.rejects(register(9, null, profile('010-3333-4444')), /신청 결과를 확인/);
    assert.equal(await countUsers(), 1, 'an unexpected transition result must also roll back creation');
    const before = await userByPhone('010-1111-2222');
    await assert.rejects(register(1, null, profile('010-1111-2222'), { fail: 'yes' }), /application rejected/);
    const after = await userByPhone('010-1111-2222');
    assert.deepEqual(after, before, 'a failed application must roll back existing guest updates');

    await assert.rejects(register(1, null, profile('010-1111-2222', { birth_date: '2007-03-15' })), /생년월일이 일치/);
    await assert.rejects(register(1, null, profile('010-5555-6666', { privacy_consent: false })), /동의/);
    await assert.rejects(register(1, null, profile('010-5555-6666', { birth_date: '2020-02-30' })), /생년월일/);
    await assert.rejects(register(1, null, profile('010-5555-6666', { birth_date: '2016-03-15' })), /법정대리인/);
    assert.equal(await countUsers(), 1);

    const memberId = crypto.randomUUID();
    await db.query(`INSERT INTO public.users(id,name,phone,birth,user_group,role,status)
        VALUES($1,'정식 회원','010-7777-8888','080315','청소년','student','approved')`, [memberId]);
    await assert.rejects(register(1, null, profile('010-7777-8888')), /기존 회원 계정/);
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM public.notice_responses WHERE user_id=$1', [memberId])).rows[0].count), 0);

    const minor = (await register(1, null, profile('010-5555-6666', {
        birth_date: '2016-03-15', guardian_name: '보호자',
        guardian_phone: '010-1111-9999', guardian_relation: '부모', guardian_consent: true,
    }))).rows[0].result;
    assert.equal(minor.guest_user.preferences.guest_birth_consent.guardian_consent, true);
    assert.equal(minor.guest_user.guardian_name, '보호자');

    const sessionId = crypto.randomUUID();
    await assert.rejects(register(null, sessionId, profile('010-9999-0000'), { fail: 'yes' }), /session rejected/);
    assert.equal(await countUsers(), 3);
    const session = (await register(null, sessionId, profile('010-9999-0000'))).rows[0].result;
    assert.equal(session.status, 'WAITLIST');
    assert.equal(await countUsers(), 4);
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM public.daily_program_session_responses')).rows[0].count), 1);

    await assert.rejects(register(null, null, profile('010-1234-9876')), /신청 대상/);
    await assert.rejects(register(1, sessionId, profile('010-1234-9876')), /신청 대상/);
    assert.equal(await countUsers(), 4);

    await db.exec('SET ROLE anon');
    const fallback = (await db.query(`INSERT INTO public.guest_program_registration_requests
        (notice_id,profile,application_answers) VALUES(1,$1::jsonb,'{}'::jsonb)
        RETURNING status,user_id,guest_user`, [JSON.stringify(profile('010-2222-3333'))])).rows[0];
    assert.equal(fallback.status, 'JOIN');
    assert.equal(fallback.user_id, fallback.guest_user.id);
    assert.deepEqual((await db.query('SELECT * FROM public.guest_program_registration_requests')).rows, []);
    assert.equal((await register(1, null, profile('010-2222-3333'))).rows[0].result.user_id, fallback.user_id);
    await db.exec('RESET ROLE');
    assert.equal(await countUsers(), 5);
    console.log('atomic guest registration: new/existing rollback, identity, consent, minor guardian, whole/session, and relation fallback passed');
} finally {
    await db.close();
}
