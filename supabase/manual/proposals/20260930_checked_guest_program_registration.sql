-- REVIEW DRAFT. The form lock stays held through identity registration and
-- application insertion; a stale form rolls the entire request back.
BEGIN;
CREATE FUNCTION public.register_guest_program_application_checked(
    p_notice_id bigint, p_session_id uuid, p_profile jsonb,
    p_answers jsonb, p_expected_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE v_notice_id bigint; v_phone_digits text;
BEGIN
    IF (p_notice_id IS NULL) = (p_session_id IS NULL) THEN
        RAISE EXCEPTION '신청 대상을 확인해 주세요.' USING ERRCODE='22023';
    END IF;
    -- The existing registration endpoint takes the phone advisory lock before
    -- locking a session/notice. Keep that order while old and new clients coexist.
    IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object'
        OR octet_length(p_profile::text) > 16384 THEN
        RAISE EXCEPTION '신청자 정보를 확인해 주세요.' USING ERRCODE='22023';
    END IF;
    v_phone_digits := regexp_replace(COALESCE(p_profile->>'phone',''), '[^0-9]', '', 'g');
    IF v_phone_digits !~ '^[0-9]{11}$' THEN
        RAISE EXCEPTION '연락처를 확인해 주세요.' USING ERRCODE='22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_phone_digits));
    IF p_session_id IS NOT NULL THEN
        SELECT notice_id INTO v_notice_id FROM public.daily_program_sessions
            WHERE id=p_session_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION '회차 정보를 확인할 수 없습니다.' USING ERRCODE='23514';
        END IF;
    ELSE
        v_notice_id := p_notice_id;
    END IF;
    PERFORM public.assert_program_application_form_revision(v_notice_id,p_expected_revision);
    RETURN public.register_guest_program_application(
        p_notice_id,p_session_id,p_profile,COALESCE(p_answers,'{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)
    TO anon, authenticated;

CREATE VIEW public.guest_program_registration_checked_requests AS
    SELECT NULL::bigint AS notice_id, NULL::uuid AS session_id,
        NULL::jsonb AS profile, NULL::jsonb AS application_answers,
        NULL::integer AS expected_revision,
        NULL::text AS status, NULL::uuid AS user_id,
        NULL::boolean AS had_prior_guest_applications,
        NULL::jsonb AS guest_user WHERE false;
CREATE FUNCTION public.insert_guest_program_registration_checked_request()
RETURNS trigger LANGUAGE plpgsql SET search_path=public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
    v_result := public.register_guest_program_application_checked(
        NEW.notice_id,NEW.session_id,NEW.profile,
        COALESCE(NEW.application_answers,'{}'::jsonb),NEW.expected_revision
    );
    NEW.status := v_result->>'status';
    NEW.user_id := (v_result->>'user_id')::uuid;
    NEW.had_prior_guest_applications := (v_result->>'had_prior_guest_applications')::boolean;
    NEW.guest_user := v_result->'guest_user';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_guest_program_registration_checked_request() FROM PUBLIC;
CREATE TRIGGER guest_program_registration_checked_insert
    INSTEAD OF INSERT ON public.guest_program_registration_checked_requests
    FOR EACH ROW EXECUTE FUNCTION public.insert_guest_program_registration_checked_request();
REVOKE ALL ON public.guest_program_registration_checked_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.guest_program_registration_checked_requests TO anon, authenticated;
COMMIT;
