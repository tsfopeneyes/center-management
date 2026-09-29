-- CUTOVER DRAFT ONLY. Apply only after the atomic guest endpoint and new
-- public client are verified. Old public-program tabs must fail before any
-- guest user mutation; kiosk/other guest registration stays available.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.register_guest_program_application(bigint,uuid,jsonb,jsonb)') IS NULL
        OR to_regclass('public.guest_program_registration_requests') IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM pg_class cls JOIN pg_namespace ns ON ns.oid = cls.relnamespace
            WHERE ns.nspname = 'public' AND cls.relname = 'users' AND cls.relrowsecurity
        ) THEN
        RAISE EXCEPTION 'Atomic guest endpoint, fallback relation, or users RLS is missing';
    END IF;
END;
$$;

CREATE POLICY program_guest_registration_verified_insert
    ON public.users AS RESTRICTIVE FOR INSERT TO anon, authenticated
    WITH CHECK (
        public.is_current_staff()
        OR user_group IS DISTINCT FROM '게스트'
        OR (
            position('공유링크 프로그램 비회원 신청' IN COALESCE(memo, '')) = 0
            AND COALESCE(preferences->'guest_birth_consent'->>'purpose', '')
                <> 'guest_program_application_and_age_analysis'
        )
    );

-- SECURITY INVOKER deliberately sees the effective DB role. A direct old
-- request runs as anon/authenticated; the reviewed atomic SECURITY DEFINER
-- function updates the guest as its owner in the same transaction.
CREATE FUNCTION public.guard_legacy_guest_program_profile_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated')
        AND NOT public.is_current_staff()
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
$$;
REVOKE ALL ON FUNCTION public.guard_legacy_guest_program_profile_write()
    FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_legacy_guest_program_profile_write
    BEFORE UPDATE OF birth,guardian_name,guardian_phone,guardian_relation,preferences
    ON public.users FOR EACH ROW
    EXECUTE FUNCTION public.guard_legacy_guest_program_profile_write();

COMMIT;
