-- DRAFT ONLY. Apply after the whole-program and session transition proposals.
-- Guest identity and application now commit or roll back together. This file
-- does not remove existing rows or old endpoints. Review live constraints,
-- phone duplicates, grants, triggers, and rollback before production use.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.program_application_transition(bigint,uuid,text,text,jsonb)') IS NULL
        OR to_regprocedure('public.program_session_transition(uuid,uuid,text,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'Whole-program and session transitions must be installed first';
    END IF;
    IF current_user IS DISTINCT FROM (
        SELECT pg_get_userbyid(cls.relowner) FROM pg_class cls
        WHERE cls.oid = to_regclass('public.users')
    ) THEN
        RAISE EXCEPTION 'Apply as the users table owner so SECURITY DEFINER bypasses public RLS';
    END IF;
    IF current_user IS DISTINCT FROM (
        SELECT pg_get_userbyid(proc.proowner) FROM pg_proc proc
        WHERE proc.oid = to_regprocedure('public.program_application_transition(bigint,uuid,text,text,jsonb)')
    ) OR current_user IS DISTINCT FROM (
        SELECT pg_get_userbyid(proc.proowner) FROM pg_proc proc
        WHERE proc.oid = to_regprocedure('public.program_session_transition(uuid,uuid,text,text,jsonb)')
    ) THEN
        RAISE EXCEPTION 'Application transitions must use the reviewed table-owner security boundary';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_guest_program_application(
    p_notice_id bigint, p_session_id uuid, p_profile jsonb,
    p_answers jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_name text;
    v_school text;
    v_phone_digits text;
    v_phone text;
    v_birth_text text;
    v_birth_date date;
    v_birth_yymmdd text;
    v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
    v_age integer;
    v_under14 boolean;
    v_guardian_name text;
    v_guardian_phone text;
    v_guardian_relation text;
    v_consent jsonb;
    v_user public.users%ROWTYPE;
    v_matches integer;
    v_verified_prior_identity boolean := false;
    v_had_prior boolean := false;
    v_result jsonb;
BEGIN
    IF (p_notice_id IS NULL) = (p_session_id IS NULL) THEN
        RAISE EXCEPTION '신청 대상을 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object'
        OR octet_length(p_profile::text) > 16384 THEN
        RAISE EXCEPTION '비회원 정보를 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    v_name := btrim(COALESCE(p_profile->>'name', ''));
    v_school := btrim(COALESCE(p_profile->>'school', ''));
    v_phone_digits := regexp_replace(COALESCE(p_profile->>'phone', ''), '[^0-9]', '', 'g');
    v_birth_text := COALESCE(p_profile->>'birth_date', '');
    IF length(v_name) NOT BETWEEN 1 AND 100 OR length(v_school) NOT BETWEEN 1 AND 200
        OR v_phone_digits !~ '^[0-9]{11}$'
        OR v_birth_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR p_profile->>'privacy_consent' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION '필수 비회원 정보와 동의를 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    BEGIN
        v_birth_date := make_date(
            substring(v_birth_text, 1, 4)::integer,
            substring(v_birth_text, 6, 2)::integer,
            substring(v_birth_text, 9, 2)::integer
        );
    EXCEPTION WHEN datetime_field_overflow THEN
        RAISE EXCEPTION '생년월일을 확인해 주세요.' USING ERRCODE = '22023';
    END;
    v_age := date_part('year', age(v_today, v_birth_date))::integer;
    IF v_birth_date > v_today OR v_age NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION '생년월일을 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    v_under14 := v_age < 14;
    v_guardian_name := btrim(COALESCE(p_profile->>'guardian_name', ''));
    v_guardian_phone := btrim(COALESCE(p_profile->>'guardian_phone', ''));
    v_guardian_relation := btrim(COALESCE(p_profile->>'guardian_relation', ''));
    IF v_under14 AND (p_profile->>'guardian_consent' IS DISTINCT FROM 'true'
        OR length(v_guardian_name) NOT BETWEEN 1 AND 100
        OR length(regexp_replace(v_guardian_phone, '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 11
        OR length(v_guardian_relation) NOT BETWEEN 1 AND 100) THEN
        RAISE EXCEPTION '법정대리인 정보와 동의를 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    IF NOT v_under14 THEN
        v_guardian_name := NULL;
        v_guardian_phone := NULL;
        v_guardian_relation := NULL;
    END IF;
    v_phone := left(v_phone_digits, 3) || '-' || substring(v_phone_digits, 4, 4)
        || '-' || right(v_phone_digits, 4);
    v_birth_yymmdd := to_char(v_birth_date, 'YYMMDD');
    v_consent := jsonb_build_object(
        'version', '2026-08-28', 'agreed_at', clock_timestamp(),
        'purpose', 'guest_program_application_and_age_analysis',
        'confirmation_method', CASE WHEN v_under14 THEN 'guardian_details_checkbox' ELSE 'self_checkbox' END,
        'guardian_consent', v_under14
    );

    -- Serialize new registrations for the same phone, even before a user row
    -- exists. A collision of hash keys only delays unrelated registrations.
    PERFORM pg_advisory_xact_lock(hashtext(v_phone_digits));
    SELECT count(*) INTO v_matches FROM public.users u
        WHERE regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = v_phone_digits;
    IF v_matches > 1 THEN
        RAISE EXCEPTION '같은 연락처의 계정이 여러 개입니다. 센터에 문의해 주세요.' USING ERRCODE = '23505';
    END IF;
    IF v_matches = 1 THEN
        SELECT * INTO v_user FROM public.users u
            WHERE regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
            FOR UPDATE;
        IF v_user.user_group IS DISTINCT FROM '게스트'
            OR COALESCE(v_user.role IN ('student', 'user'), false) IS DISTINCT FROM true
            OR v_user.status = 'withdrawn' THEN
            RAISE EXCEPTION '기존 회원 계정으로 로그인한 뒤 신청해 주세요.' USING ERRCODE = '42501';
        END IF;
        IF v_user.birth::text ~ '^[0-9]{6}$'
            AND v_user.birth::text NOT IN ('000000', '999999', '990101') THEN
            IF v_user.birth::text <> v_birth_yymmdd THEN
                RAISE EXCEPTION '같은 연락처의 생년월일이 일치하지 않습니다. 센터에 문의해 주세요.'
                    USING ERRCODE = '42501';
            END IF;
            v_verified_prior_identity := true;
        END IF;
        IF v_verified_prior_identity THEN
            SELECT EXISTS (
                SELECT 1 FROM public.notice_responses r
                WHERE r.user_id = v_user.id AND r.status = 'JOIN'
            ) INTO v_had_prior;
        END IF;
        UPDATE public.users u SET
            birth = v_birth_yymmdd,
            guardian_name = v_guardian_name,
            guardian_phone = v_guardian_phone,
            guardian_relation = v_guardian_relation,
            preferences = COALESCE(u.preferences, '{}'::jsonb)
                || jsonb_build_object('guest_birth_consent', v_consent)
        WHERE u.id = v_user.id RETURNING * INTO v_user;
    ELSE
        INSERT INTO public.users (
            id, name, gender, school, birth, phone, phone_back4,
            guardian_name, guardian_phone, guardian_relation, preferences,
            user_group, password, role, status, memo
        ) VALUES (
            gen_random_uuid(), v_name, 'M', v_school, v_birth_yymmdd,
            v_phone, right(v_phone_digits, 4),
            v_guardian_name, v_guardian_phone, v_guardian_relation,
            jsonb_build_object('guest_birth_consent', v_consent),
            '게스트', NULL, 'student', 'approved',
            '[가입일: ' || to_char(v_today, 'YYYY-MM-DD') || '] [공유링크 프로그램 비회원 신청]'
        ) RETURNING * INTO v_user;
    END IF;

    IF p_notice_id IS NOT NULL THEN
        v_result := public.program_application_transition(
            p_notice_id, v_user.id, 'JOIN', 'GUEST', COALESCE(p_answers, '{}'::jsonb)
        );
    ELSE
        v_result := public.program_session_transition(
            p_session_id, v_user.id, 'JOIN', 'GUEST', COALESCE(p_answers, '{}'::jsonb)
        );
    END IF;
    IF COALESCE(v_result->>'status', '') NOT IN ('JOIN', 'WAITLIST') THEN
        RAISE EXCEPTION '신청 결과를 확인할 수 없습니다.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
        'status', v_result->>'status', 'user_id', v_user.id,
        'had_prior_guest_applications', v_had_prior,
        'guest_user', jsonb_build_object(
            'id', v_user.id, 'name', v_user.name, 'school', v_user.school,
            'phone', v_user.phone, 'phone_back4', v_user.phone_back4,
            'birth', v_user.birth, 'user_group', v_user.user_group,
            'role', v_user.role, 'status', v_user.status,
            'guardian_name', v_user.guardian_name,
            'guardian_phone', v_user.guardian_phone,
            'guardian_relation', v_user.guardian_relation,
            'preferences', v_user.preferences
        )
    );
END;
$$;
REVOKE ALL ON FUNCTION public.register_guest_program_application(bigint,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_guest_program_application(bigint,uuid,jsonb,jsonb)
    TO anon, authenticated;

-- Empty insert-only relation for PostgREST RPC cache misses. Both paths run
-- the exact same server transaction and return no pre-existing users/rows.
CREATE VIEW public.guest_program_registration_requests AS
    SELECT NULL::bigint AS notice_id, NULL::uuid AS session_id,
        NULL::jsonb AS profile, NULL::jsonb AS application_answers,
        NULL::text AS status, NULL::uuid AS user_id,
        NULL::boolean AS had_prior_guest_applications,
        NULL::jsonb AS guest_user WHERE false;
CREATE FUNCTION public.insert_guest_program_registration_request()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
    v_result := public.register_guest_program_application(
        NEW.notice_id, NEW.session_id, NEW.profile,
        COALESCE(NEW.application_answers, '{}'::jsonb)
    );
    NEW.status := v_result->>'status';
    NEW.user_id := (v_result->>'user_id')::uuid;
    NEW.had_prior_guest_applications := (v_result->>'had_prior_guest_applications')::boolean;
    NEW.guest_user := v_result->'guest_user';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_guest_program_registration_request() FROM PUBLIC;
CREATE TRIGGER guest_program_registration_insert
    INSTEAD OF INSERT ON public.guest_program_registration_requests
    FOR EACH ROW EXECUTE FUNCTION public.insert_guest_program_registration_request();
REVOKE ALL ON public.guest_program_registration_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.guest_program_registration_requests TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
