import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { getDailySessionRegistrationBlockReason } from '../src/utils/dailyProgramSessions.js';
import { parseGuestBirthDate } from '../src/utils/guestBirthUtils.js';

// Isolated PostgreSQL engine; no network, credentials or production data.
const db = new PGlite();
const guest = crypto.randomUUID(), other = crypto.randomUUID(), member = crypto.randomUUID();
const session = crypto.randomUUID();
try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
        CREATE FUNCTION public.calendar_is_admin() RETURNS boolean LANGUAGE sql AS 'SELECT false';
        CREATE TABLE public.users(id uuid PRIMARY KEY, auth_user_id uuid, name text, phone text, birth text, user_group text, role text, status text);
        CREATE TABLE public.notices(id bigint PRIMARY KEY, category text, is_recruiting boolean, is_challenge boolean, guest_properties jsonb, program_status text);`);
    for (const path of ['20260907050000_daily_open_program_sessions.sql', '20260907060000_generalize_daily_program_sessions.sql',
        '20260908030000_add_daily_session_fields.sql', '20260908040000_add_daily_session_voiding.sql']) {
        await db.exec(readFileSync(new URL('../supabase/migrations/' + path, import.meta.url), 'utf8'));
    }
    await db.query(`INSERT INTO public.users VALUES
        ($1,NULL,'테스트게스트','010-1234-5678','080315','게스트','student','approved'),
        ($2,NULL,'대기게스트','010-1111-2222','080315','게스트','student','approved'),
        ($3,NULL,'정식회원','010-2222-3333','080315','청소년','user','approved')`, [guest, other, member]);
    await db.exec(`INSERT INTO public.notices VALUES(1,'PROGRAM',false,false,
        '{"open_participation_mode":"SESSION_RSVP","allow_guest":true,"custom_fields":[{"id":"a","required":true}]}','ACTIVE')`);
    await db.query(`INSERT INTO public.daily_program_sessions(id,notice_id,session_date,starts_at,session_summary,capacity)
        VALUES($1,1,(now() AT TIME ZONE 'Asia/Seoul')::date,now()+interval '1 hour','오늘 내용',1)`, [session]);
    const beforeUsers = (await db.query('SELECT * FROM public.users ORDER BY id')).rows;
    await db.exec(readFileSync(new URL('../supabase/manual/proposals/20260910_guest_daily_applications.sql', import.meta.url), 'utf8'));
    const apply = async (id = guest, name = '테스트게스트', phone = '010-1234-5678', birth = '080315', answers = { a: '답변' }) =>
        (await db.query('SELECT public.apply_guest_program_session($1,$2,$3,$4,$5,$6) AS result',
            [session, id, name, phone, birth, answers])).rows[0].result;
    await db.exec('SET ROLE anon');
    await assert.rejects(apply(guest, '다른이름'), /신청자/);
    await assert.rejects(apply(guest, '테스트게스트', '010-9999-9999'), /신청자/);
    await assert.rejects(apply(guest, '테스트게스트', '010-1234-5678', '080316'), /신청자/);
    await assert.rejects(apply(member, '정식회원', '010-2222-3333'), /신청자/);
    await assert.rejects(apply(guest, '테스트게스트', '010-1234-5678', '080315', {}), /필수/);
    assert.equal((await apply()).status, 'JOIN');
    assert.equal((await apply()).status, 'JOIN');
    const fallback = await db.query(`INSERT INTO public.guest_program_session_applications
        (session_id,user_id,name,phone,birth,application_answers) VALUES($1,$2,'대기게스트','010-1111-2222','080315','{"a":"대기 답변"}') RETURNING status`, [session, other]);
    assert.equal(fallback.rows[0].status, 'WAITLIST');
    assert.deepEqual((await db.query('SELECT * FROM public.guest_program_session_applications')).rows, []);
    await assert.rejects(db.query('SELECT * FROM public.daily_program_session_responses'), /permission denied/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.daily_program_session_responses')).rows[0].n, 2);
    assert.equal((await db.query('SELECT join_count FROM public.daily_program_sessions')).rows[0].join_count, 1);
    assert.deepEqual((await db.query('SELECT * FROM public.users ORDER BY id')).rows, beforeUsers);
    assert.equal((await db.query('SELECT application_answers FROM public.daily_program_session_responses WHERE user_id=$1', [other])).rows[0].application_answers.a, '대기 답변');
    await db.exec(`UPDATE public.notices SET guest_properties = guest_properties || '{"allow_guest":false}'`);
    await assert.rejects(apply(), /비활성화/);
    await db.exec(`UPDATE public.notices SET guest_properties = guest_properties || '{"allow_guest":true}'; UPDATE public.daily_program_sessions SET status='CLOSED'`);
    await assert.rejects(apply(), /마감/);
    await db.exec(`UPDATE public.daily_program_sessions SET status='OPEN', starts_at=now()-interval '1 second'`);
    await assert.rejects(apply(), /마감/);
    const now = Date.parse('2026-09-10T10:00:00+09:00');
    const notice = { today_session: { session_date: '2026-09-10', starts_at: '2026-09-10T11:00:00+09:00', status: 'OPEN' } };
    assert.equal(getDailySessionRegistrationBlockReason(notice, now), null);
    assert.ok(getDailySessionRegistrationBlockReason(notice, now + 3600000));
    assert.ok(getDailySessionRegistrationBlockReason(notice, now + 86400000));
    assert.ok(parseGuestBirthDate('2008-02-29'));
    assert.equal(parseGuestBirthDate('2009-02-29'), null);
    assert.equal(parseGuestBirthDate('2099-01-01'), null);
    console.log('PASS: guest RPC and direct insert fallback, identity restrictions, required answers, capacity/waitlist, retries, closed sessions, no guest data disclosure, preserved users and birth validation. Isolated database only.');
} finally {
    await db.close();
}
