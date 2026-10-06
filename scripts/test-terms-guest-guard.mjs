import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
    await db.exec(`CREATE ROLE account_profile_worker; CREATE ROLE authenticated;
        CREATE TABLE public.users(id integer PRIMARY KEY,user_group text,preferences jsonb,birth text,
          guardian_name text,guardian_phone text,guardian_relation text);
        INSERT INTO public.users VALUES
          (1,'졸업생','{}'::jsonb,NULL,NULL,NULL,NULL),
          (2,'게스트','{}'::jsonb,NULL,NULL,NULL,NULL);
        GRANT SELECT,UPDATE ON public.users TO account_profile_worker,authenticated;
        CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
        REVOKE ALL ON FUNCTION public.is_current_staff() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.is_current_staff() TO authenticated;
        CREATE FUNCTION public.guard_legacy_guest_program_profile_write()
          RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_catalog AS $$
        BEGIN
          IF current_user IN ('anon','authenticated') AND NOT public.is_current_staff()
            AND OLD.user_group='게스트'
            AND COALESCE(NEW.preferences->'guest_birth_consent'->>'purpose','')
              ='guest_program_application_and_age_analysis' THEN
            RAISE EXCEPTION 'blocked' USING ERRCODE='42501';
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER guard_legacy_guest_program_profile_write
          BEFORE UPDATE OF preferences ON public.users FOR EACH ROW
          EXECUTE FUNCTION public.guard_legacy_guest_program_profile_write();`);
    await db.exec('SET ROLE account_profile_worker');
    await assert.rejects(db.exec(`UPDATE public.users SET preferences='{"terms_agreed":true}'::jsonb WHERE id=1`),
        /permission denied for function is_current_staff/);
    await db.exec('RESET ROLE');
    const migration = await readFile('supabase/migrations/20260930020000_fix_member_terms_guest_guard.sql', 'utf8');
    await db.exec(migration);
    await db.exec('SET ROLE account_profile_worker');
    await db.exec(`UPDATE public.users SET preferences='{"terms_agreed":true}'::jsonb WHERE id=1`);
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.exec(`UPDATE public.users SET preferences=
      '{"guest_birth_consent":{"purpose":"guest_program_application_and_age_analysis"}}'::jsonb WHERE id=2`),
    /공개 프로그램 비회원 정보는 새 신청 화면에서 저장해 주세요/);
    await db.exec('RESET ROLE');
    console.log('PASS guest guard: member terms save succeeds; legacy guest write remains blocked');
} finally {
    await db.close();
}
