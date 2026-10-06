import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
    await db.exec(`
        CREATE ROLE anon; CREATE ROLE authenticated;
        CREATE TABLE public.notice_responses (id integer PRIMARY KEY, application_audience text);
        CREATE TABLE public.daily_program_session_responses (id integer PRIMARY KEY, application_audience text);
        GRANT SELECT,INSERT,UPDATE ON public.notice_responses,public.daily_program_session_responses TO anon,authenticated;
        CREATE FUNCTION public.record_test_audience(p_id integer, p_audience text)
        RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
            UPDATE public.notice_responses SET application_audience=p_audience WHERE id=p_id;
        END $$;
        GRANT EXECUTE ON FUNCTION public.record_test_audience(integer,text) TO authenticated;
        INSERT INTO public.notice_responses VALUES (1,NULL);
        INSERT INTO public.daily_program_session_responses VALUES (1,NULL);
    `);
    await db.exec(readFileSync(new URL('../supabase/manual/proposals/20260930_program_application_audience_write_guard.sql', import.meta.url), 'utf8'));
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.exec("UPDATE public.notice_responses SET application_audience='GUEST' WHERE id=1"), /신청 당시 대상/);
    await assert.rejects(db.exec("INSERT INTO public.daily_program_session_responses VALUES (2,'MEMBER')"), /신청 당시 대상/);
    await db.exec("SELECT public.record_test_audience(1,'MEMBER')");
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT application_audience FROM public.notice_responses WHERE id=1')).rows[0].application_audience, 'MEMBER');
    await db.exec('SET ROLE anon');
    await assert.rejects(db.exec("UPDATE public.notice_responses SET application_audience='GUEST' WHERE id=1"), /신청 당시 대상/);
    await db.exec('RESET ROLE');
    console.log('direct audience spoofing denied; verified server-side write preserved');
} finally {
    await db.close();
}
