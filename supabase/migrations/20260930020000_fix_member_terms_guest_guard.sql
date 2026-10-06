BEGIN;

-- The guest-program cutover installs this trigger outside the numbered
-- migrations. Repair it only where that cutover is active. A member profile
-- worker must return before evaluating the staff-only helper.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'guard_legacy_guest_program_profile_write'
      AND NOT tgisinternal
  ) THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.guard_legacy_guest_program_profile_write()
      RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
      SET search_path = public, pg_catalog AS $body$
      BEGIN
        IF current_user NOT IN ('anon', 'authenticated') THEN
          RETURN NEW;
        END IF;

        IF NOT public.is_current_staff()
            AND OLD.user_group = '게스트'
            AND COALESCE(NEW.preferences->'guest_birth_consent'->>'purpose', '')
                = 'guest_program_application_and_age_analysis'
            AND (
              NEW.preferences->'guest_birth_consent' IS DISTINCT FROM OLD.preferences->'guest_birth_consent'
              OR NEW.birth IS DISTINCT FROM OLD.birth
              OR NEW.guardian_name IS DISTINCT FROM OLD.guardian_name
              OR NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone
              OR NEW.guardian_relation IS DISTINCT FROM OLD.guardian_relation
            ) THEN
          RAISE EXCEPTION '공개 프로그램 비회원 정보는 새 신청 화면에서 저장해 주세요.'
              USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
      END;
      $body$
    $function$;
  END IF;
END;
$migration$;

COMMIT;
