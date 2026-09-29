-- DRAFT ONLY. Requires the form snapshots, cancellation-history, whole
-- transition, and session attempt-history proposals before client cutover.
-- A staff walk-in is attended immediately and may exceed public capacity.
-- Existing active answers remain intact; a cancelled attempt is archived by
-- the history trigger before the new manual attempt clears its old answers.
BEGIN;

DO $$
BEGIN
    IF to_regclass('public.program_application_attempt_history') IS NULL
        OR to_regclass('public.program_session_application_attempt_history') IS NULL
        OR to_regprocedure('public.is_current_staff()') IS NULL THEN
        RAISE EXCEPTION 'Application history or staff guard is missing';
    END IF;
END;
$$;

CREATE FUNCTION public.add_staff_program_walkins(p_notice_id bigint, p_user_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    v_notice public.notices%ROWTYPE;
    v_user_id uuid;
    v_status text;
    v_count integer := 0;
BEGIN
    IF public.is_current_staff() IS DISTINCT FROM true THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;
    IF p_user_ids IS NULL OR cardinality(p_user_ids) NOT BETWEEN 1 AND 200
        OR array_position(p_user_ids, NULL) IS NOT NULL THEN
        RAISE EXCEPTION '참여자 목록을 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_notice FROM public.notices WHERE id = p_notice_id FOR UPDATE;
    IF NOT FOUND OR v_notice.category <> 'PROGRAM' OR v_notice.is_challenge IS TRUE
        OR v_notice.is_recruiting IS DISTINCT FROM true THEN
        RAISE EXCEPTION '모집 프로그램이 아닙니다.' USING ERRCODE = '23514';
    END IF;

    FOR v_user_id IN SELECT DISTINCT unnest(p_user_ids) AS id ORDER BY id LOOP
        SELECT status INTO v_status FROM public.notice_responses
            WHERE notice_id = p_notice_id AND user_id = v_user_id;
        IF v_status IS NULL THEN
            INSERT INTO public.notice_responses (
                notice_id, user_id, status, is_attended, application_answers,
                application_form_revision, application_form_snapshot
            ) VALUES (p_notice_id, v_user_id, 'JOIN', true, '{}'::jsonb, NULL, NULL);
        ELSIF v_status = 'CANCELLED' THEN
            UPDATE public.notice_responses SET
                status = 'JOIN', is_attended = true, created_at = clock_timestamp(),
                cancelled_at = NULL, application_answers = '{}'::jsonb,
                application_form_revision = NULL, application_form_snapshot = NULL
            WHERE notice_id = p_notice_id AND user_id = v_user_id;
        ELSE
            UPDATE public.notice_responses SET status = 'JOIN', is_attended = true
                WHERE notice_id = p_notice_id AND user_id = v_user_id;
        END IF;
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.add_staff_program_walkins(bigint,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_staff_program_walkins(bigint,uuid[]) TO authenticated;

CREATE VIEW public.staff_program_walkins AS
    SELECT NULL::bigint AS notice_id, NULL::uuid[] AS user_ids,
        NULL::integer AS added_count WHERE false;
CREATE FUNCTION public.insert_staff_program_walkins()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    NEW.added_count := (public.add_staff_program_walkins(NEW.notice_id, NEW.user_ids)->>'count')::integer;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_staff_program_walkins() FROM PUBLIC;
CREATE TRIGGER staff_program_walkins_insert
    INSTEAD OF INSERT ON public.staff_program_walkins
    FOR EACH ROW EXECUTE FUNCTION public.insert_staff_program_walkins();
REVOKE ALL ON public.staff_program_walkins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.staff_program_walkins TO authenticated;

CREATE FUNCTION public.add_staff_program_session_walkins(p_session_id uuid, p_user_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    v_session public.daily_program_sessions%ROWTYPE;
    v_user_id uuid;
    v_status text;
    v_count integer := 0;
BEGIN
    IF public.is_current_staff() IS DISTINCT FROM true THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;
    IF p_user_ids IS NULL OR cardinality(p_user_ids) NOT BETWEEN 1 AND 200
        OR array_position(p_user_ids, NULL) IS NOT NULL THEN
        RAISE EXCEPTION '참여자 목록을 확인해 주세요.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '회차를 찾을 수 없습니다.' USING ERRCODE = '23514';
    END IF;

    FOR v_user_id IN SELECT DISTINCT unnest(p_user_ids) AS id ORDER BY id LOOP
        SELECT status INTO v_status FROM public.daily_program_session_responses
            WHERE session_id = p_session_id AND user_id = v_user_id;
        IF v_status IS NULL THEN
            INSERT INTO public.daily_program_session_responses (
                session_id, user_id, status, is_attended, application_answers,
                application_form_revision, application_form_snapshot
            ) VALUES (p_session_id, v_user_id, 'JOIN', true, '{}'::jsonb, NULL, NULL);
        ELSIF v_status = 'CANCELLED' THEN
            UPDATE public.daily_program_session_responses SET
                status = 'JOIN', is_attended = true, created_at = clock_timestamp(),
                cancelled_at = NULL, application_answers = '{}'::jsonb,
                application_form_revision = NULL, application_form_snapshot = NULL
            WHERE session_id = p_session_id AND user_id = v_user_id;
        ELSE
            UPDATE public.daily_program_session_responses SET status = 'JOIN', is_attended = true
                WHERE session_id = p_session_id AND user_id = v_user_id;
        END IF;
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.add_staff_program_session_walkins(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_staff_program_session_walkins(uuid,uuid[]) TO authenticated;

CREATE VIEW public.staff_program_session_walkins AS
    SELECT NULL::uuid AS session_id, NULL::uuid[] AS user_ids,
        NULL::integer AS added_count WHERE false;
CREATE FUNCTION public.insert_staff_program_session_walkins()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    NEW.added_count := (public.add_staff_program_session_walkins(NEW.session_id, NEW.user_ids)->>'count')::integer;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_staff_program_session_walkins() FROM PUBLIC;
CREATE TRIGGER staff_program_session_walkins_insert
    INSTEAD OF INSERT ON public.staff_program_session_walkins
    FOR EACH ROW EXECUTE FUNCTION public.insert_staff_program_session_walkins();
REVOKE ALL ON public.staff_program_session_walkins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.staff_program_session_walkins TO authenticated;

CREATE FUNCTION public.cancel_staff_program_session_application(
    p_session_id uuid, p_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    v_session public.daily_program_sessions%ROWTYPE;
    v_status text;
    v_join_count integer;
    v_promote_user uuid;
BEGIN
    IF public.is_current_staff() IS DISTINCT FROM true THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions
        WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '회차를 찾을 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    SELECT status INTO v_status FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND user_id = p_user_id;
    IF v_status IS NULL OR v_status = 'CANCELLED' THEN
        RETURN jsonb_build_object('status', 'CANCELLED');
    END IF;
    UPDATE public.daily_program_session_responses SET
        status = 'CANCELLED', cancelled_at = clock_timestamp()
        WHERE session_id = p_session_id AND user_id = p_user_id;
    IF v_status = 'JOIN' AND v_session.capacity > 0 AND v_session.voided_at IS NULL THEN
        SELECT count(*) INTO v_join_count FROM public.daily_program_session_responses
            WHERE session_id = p_session_id AND status = 'JOIN';
        IF v_join_count < v_session.capacity THEN
            SELECT user_id INTO v_promote_user FROM public.daily_program_session_responses
                WHERE session_id = p_session_id AND status = 'WAITLIST'
                ORDER BY created_at, user_id LIMIT 1 FOR UPDATE;
            IF v_promote_user IS NOT NULL THEN
                UPDATE public.daily_program_session_responses
                    SET status = 'JOIN', cancelled_at = NULL
                    WHERE session_id = p_session_id AND user_id = v_promote_user;
            END IF;
        END IF;
    END IF;
    RETURN jsonb_build_object('status', 'CANCELLED');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_staff_program_session_application(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_staff_program_session_application(uuid,uuid) TO authenticated;

CREATE VIEW public.staff_program_session_cancellations AS
    SELECT NULL::uuid AS session_id, NULL::uuid AS user_id,
        NULL::text AS status WHERE false;
CREATE FUNCTION public.insert_staff_program_session_cancellation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    NEW.status := public.cancel_staff_program_session_application(NEW.session_id, NEW.user_id)->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_staff_program_session_cancellation() FROM PUBLIC;
CREATE TRIGGER staff_program_session_cancellation_insert
    INSTEAD OF INSERT ON public.staff_program_session_cancellations
    FOR EACH ROW EXECUTE FUNCTION public.insert_staff_program_session_cancellation();
REVOKE ALL ON public.staff_program_session_cancellations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.staff_program_session_cancellations TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
