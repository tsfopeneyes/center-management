import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated RLS/trigger test: no production connection or user rows.
const db = new PGlite();
const apply = name => db.exec(readFileSync(new URL(`../supabase/manual/proposals/${name}`, import.meta.url), 'utf8'));
const profile = {
    name: '새 비회원', school: '테스트 학교', phone: '010-1111-2222',
    birth_date: '2008-03-15', privacy_consent: true,
};

try {
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql AS $$
            SELECT COALESCE(current_setting('test.admin', true), 'false') = 'true'
        $$;
        CREATE TABLE public.users (
            id uuid PRIMARY KEY, name text, gender text, school text, birth text,
            phone text, phone_back4 text, guardian_name text, guardian_phone text,
            guardian_relation text, preferences jsonb, user_group text,
            password text, role text, status text, memo text
        );
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        CREATE POLICY old_broad_users ON public.users FOR ALL TO PUBLIC
            USING (true) WITH CHECK (true);
        GRANT SELECT,INSERT,UPDATE ON public.users TO anon, authenticated;
        CREATE TABLE public.notice_responses (
            notice_id bigint, user_id uuid, status text,
            PRIMARY KEY(notice_id,user_id)
        );
        CREATE FUNCTION public.program_application_transition(
            p_notice_id bigint,p_user_id uuid,p_action text,p_audience text,p_answers jsonb
        ) RETURNS jsonb LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO public.notice_responses VALUES(p_notice_id,p_user_id,'JOIN')
                ON CONFLICT DO NOTHING;
            RETURN '{"status":"JOIN"}'::jsonb;
        END;
        $$;
        CREATE FUNCTION public.program_session_transition(uuid,uuid,text,text,jsonb)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"status":"JOIN"}'::jsonb $$;
    `);
    await apply('20260929_atomic_guest_program_registration.sql');
    await apply('20260929_guest_registration_legacy_cutover.sql');
    await db.exec('SET ROLE anon');

    const oldGuestId = crypto.randomUUID();
    await assert.rejects(db.query(`INSERT INTO public.users
        (id,name,phone,phone_back4,user_group,role,status,memo,preferences)
        VALUES($1,'구버전 신청','010-3333-4444','4444','게스트','student','approved',
            '[공유링크 프로그램 비회원 신청]',
            '{"guest_birth_consent":{"purpose":"guest_program_application_and_age_analysis"}}'::jsonb)`,
    [oldGuestId]), /row-level security/);

    const kioskId = crypto.randomUUID();
    await db.query(`INSERT INTO public.users
        (id,name,phone,phone_back4,user_group,role,status,memo,preferences)
        VALUES($1,'방문 비회원','010-5555-6666','6666','게스트','student','approved',
            '[게스트 방문]',
            '{"guest_birth_consent":{"purpose":"guest_visit_age_analysis"}}'::jsonb)`, [kioskId]);

    const first = (await db.query(`SELECT public.register_guest_program_application(
        1,NULL,$1::jsonb,'{}'::jsonb) AS result`, [JSON.stringify(profile)])).rows[0].result;
    assert.equal(first.status, 'JOIN');
    assert.equal(first.guest_user.id, first.user_id);

    await assert.rejects(db.query(`UPDATE public.users SET
        preferences='{"guest_birth_consent":{"purpose":"guest_program_application_and_age_analysis","agreed_at":"later"}}'::jsonb
        WHERE id=$1`, [first.user_id]), /새 신청 화면/);
    const second = (await db.query(`INSERT INTO public.guest_program_registration_requests
        (notice_id,profile,application_answers) VALUES(1,$1::jsonb,'{}'::jsonb)
        RETURNING status,user_id`, [JSON.stringify(profile)])).rows[0];
    assert.equal(second.user_id, first.user_id, 'atomic update remains available after cutover');

    await db.query(`UPDATE public.users SET
        preferences='{"guest_birth_consent":{"purpose":"guest_visit_age_analysis"}}'::jsonb
        WHERE id=$1`, [kioskId]);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.users')).rows[0].count, 2);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.notice_responses')).rows[0].count, 1);
    console.log('legacy public guest writes blocked before mutation; atomic and kiosk guest paths preserved');
} finally {
    await db.close();
}
