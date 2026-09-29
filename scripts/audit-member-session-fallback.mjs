import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Safety audit against repository migrations only. This never connects to the
// linked Supabase project and must not be used to infer the live schema.
const db = new PGlite();
const members = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const sessionId = crypto.randomUUID();

try {
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
            SELECT NULLIF(current_setting('test.member_id', true), '')::uuid
        $$;
        CREATE FUNCTION public.calendar_is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
        CREATE TABLE public.users (
            id uuid PRIMARY KEY, auth_user_id uuid, name text, phone text, birth text,
            user_group text, role text, status text
        );
        CREATE TABLE public.notices (
            id bigint PRIMARY KEY, category text, is_recruiting boolean,
            is_challenge boolean, guest_properties jsonb, program_status text
        );
        GRANT SELECT ON public.users TO authenticated;
    `);

    for (const filename of [
        '20260907050000_daily_open_program_sessions.sql',
        '20260907060000_generalize_daily_program_sessions.sql',
        '20260908030000_add_daily_session_fields.sql',
        '20260908040000_add_daily_session_voiding.sql',
    ]) {
        await db.exec(readFileSync(new URL(`../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
    }
    await db.exec(readFileSync(new URL('../supabase/manual/proposals/20260910_guest_daily_applications.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/manual/proposals/20260911_recurring_session_applications.sql', import.meta.url), 'utf8'));

    for (let index = 0; index < members.length; index += 1) {
        await db.query('INSERT INTO public.users VALUES ($1,$1,$2,NULL,NULL,$3,$4,$5)',
            [members[index], `테스트 회원 ${index + 1}`, '청소년', 'user', 'approved']);
    }
    await db.exec(`INSERT INTO public.notices VALUES (
        1, 'PROGRAM', true, false,
        '{"schedule_mode":"RECURRING","application_scope":"SESSION"}', 'ACTIVE'
    )`);
    await db.query(`INSERT INTO public.daily_program_sessions
        (id, notice_id, session_date, starts_at, session_summary, capacity)
        VALUES ($1, 1, (now() AT TIME ZONE 'Asia/Seoul')::date + 1,
            now() + interval '1 day', '테스트 회차', 1)`, [sessionId]);

    await db.exec('SET ROLE authenticated');
    for (const [index, expected] of [[0, 'JOIN'], [1, 'WAITLIST']]) {
        await db.query("SELECT set_config('test.member_id', $1, false)", [members[index]]);
        const result = await db.query('SELECT public.respond_to_program_session($1,$2,$3) AS result',
            [sessionId, members[index], 'JOIN']);
        if (result.rows[0].result.status !== expected) {
            throw new Error(`RPC result changed: expected ${expected}`);
        }
    }

    await db.query("SELECT set_config('test.member_id', $1, false)", [members[2]]);
    let directInsertError = null;
    try {
        await db.query(`INSERT INTO public.daily_program_session_responses
            (session_id, user_id, status) VALUES ($1,$2,'JOIN')`, [sessionId, members[2]]);
    } catch (error) {
        directInsertError = error;
    }
    await db.exec('RESET ROLE');
    const result = await db.query(`SELECT count(*)::int AS joined
        FROM public.daily_program_session_responses
        WHERE session_id = $1 AND status = 'JOIN'`, [sessionId]);
    const joined = result.rows[0].joined;

    if (joined > 1) {
        console.error('UNSAFE: direct member table insert exceeded session capacity in the repository schema.');
        process.exitCode = 1;
    } else if (directInsertError) {
        console.log(`Direct member insert was rejected: ${directInsertError.message}`);
    } else {
        console.log('Direct member insert preserved capacity in the repository schema.');
    }
} finally {
    await db.close();
}
