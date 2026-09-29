-- REVIEW DRAFT. Session lock order matches program_session_transition:
-- session row first, then notice row. Cancelling never requires a current form.
BEGIN;
CREATE FUNCTION public.respond_to_program_session_checked(
    p_session_id uuid, p_user_id uuid, p_action text,
    p_answers jsonb, p_expected_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE v_notice_id bigint;
BEGIN
    IF p_action IS DISTINCT FROM 'CANCEL' THEN
        SELECT notice_id INTO v_notice_id FROM public.daily_program_sessions
            WHERE id=p_session_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION '회차 정보를 확인할 수 없습니다.' USING ERRCODE='23514';
        END IF;
        PERFORM public.assert_program_application_form_revision(v_notice_id,p_expected_revision);
    END IF;
    RETURN public.respond_to_program_session(
        p_session_id,p_user_id,p_action,COALESCE(p_answers,'{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)
    TO authenticated;

CREATE VIEW public.member_program_session_checked_requests AS
    SELECT NULL::uuid AS session_id, NULL::uuid AS user_id,
        NULL::text AS action, NULL::jsonb AS application_answers,
        NULL::integer AS expected_revision, NULL::text AS status WHERE false;
CREATE FUNCTION public.insert_member_program_session_checked_request()
RETURNS trigger LANGUAGE plpgsql SET search_path=public, pg_temp AS $$
BEGIN
    NEW.status := public.respond_to_program_session_checked(
        NEW.session_id,NEW.user_id,NEW.action,
        COALESCE(NEW.application_answers,'{}'::jsonb),NEW.expected_revision
    )->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_member_program_session_checked_request() FROM PUBLIC;
CREATE TRIGGER member_program_session_checked_insert
    INSTEAD OF INSERT ON public.member_program_session_checked_requests
    FOR EACH ROW EXECUTE FUNCTION public.insert_member_program_session_checked_request();
REVOKE ALL ON public.member_program_session_checked_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.member_program_session_checked_requests TO authenticated;
COMMIT;
