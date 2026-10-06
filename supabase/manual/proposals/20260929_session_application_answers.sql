-- DRAFT ONLY. Requires the snapshot proposal and the reviewed member-session
-- write boundary. Do not apply before all member/guest clients send answers.
BEGIN;

CREATE OR REPLACE FUNCTION public.program_session_transition(
    p_session_id uuid, p_user_id uuid, p_action text,
    p_audience text, p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_session public.daily_program_sessions%ROWTYPE;
    v_program public.notices%ROWTYPE;
    v_existing_status text;
    v_status text;
    v_join_count integer;
    v_promote_user uuid;
    v_field jsonb;
BEGIN
    IF p_action IS NULL OR p_action NOT IN ('JOIN', 'WAITLIST', 'CANCEL')
        OR p_audience IS NULL OR p_audience NOT IN ('MEMBER', 'GUEST') THEN
        RAISE EXCEPTION 'Invalid application action or audience' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions
        WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND OR v_session.voided_at IS NOT NULL THEN
        RAISE EXCEPTION '회차 정보를 확인할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_program FROM public.notices
        WHERE id = v_session.notice_id FOR SHARE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM'
        OR v_program.is_challenge IS TRUE
        OR v_program.program_status IN ('COMPLETED', 'CANCELLED')
        OR v_program.guest_properties->>'is_ended' = 'true'
        OR (p_audience = 'GUEST' AND v_program.guest_properties->>'allow_guest' = 'false')
        OR NOT (
            (v_program.is_recruiting IS TRUE
                AND v_program.guest_properties->>'schedule_mode' = 'RECURRING'
                AND v_program.guest_properties->>'application_scope' = 'SESSION')
            OR (v_program.is_recruiting IS FALSE
                AND v_program.guest_properties->>'open_participation_mode' = 'SESSION_RSVP')
        ) THEN
        RAISE EXCEPTION '회차별 신청이 비활성화되어 있습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_program.is_leader_only IS TRUE AND (
        p_audience = 'GUEST' OR NOT EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.is_leader IS TRUE
        )
    ) THEN
        RAISE EXCEPTION '리더만 신청할 수 있는 프로그램입니다.' USING ERRCODE = '42501';
    END IF;

    SELECT status INTO v_existing_status FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND user_id = p_user_id;
    IF p_action = 'CANCEL' THEN
        IF v_existing_status NOT IN ('JOIN', 'WAITLIST') OR v_existing_status IS NULL THEN
            RETURN jsonb_build_object('status', 'CANCELLED');
        END IF;
        UPDATE public.daily_program_session_responses
            SET status = 'CANCELLED', cancelled_at = now()
            WHERE session_id = p_session_id AND user_id = p_user_id;
        IF v_existing_status = 'JOIN' AND v_session.capacity > 0 THEN
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
    END IF;
    IF v_session.status <> 'OPEN' OR clock_timestamp() >= v_session.starts_at THEN
        RAISE EXCEPTION '신청이 마감되었습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_existing_status IN ('JOIN', 'WAITLIST') THEN
        RETURN jsonb_build_object('status', v_existing_status);
    END IF;
    IF public.program_application_audience_for_user(p_user_id) IS DISTINCT FROM p_audience THEN
        RAISE EXCEPTION '신청자 회원 구분을 확인해 주세요.' USING ERRCODE = '42501';
    END IF;

    IF v_program.application_form IS NOT NULL THEN
        PERFORM public.validate_program_application_answers(
            v_program.application_form, p_audience, p_answers
        );
    ELSIF p_audience = 'GUEST' THEN
        IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
            OR octet_length(p_answers::text) > 20000 THEN
            RAISE EXCEPTION '신청 내용을 확인해 주세요.' USING ERRCODE = '22023';
        END IF;
        FOR v_field IN SELECT value FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(v_program.guest_properties->'custom_fields') = 'array'
                THEN v_program.guest_properties->'custom_fields' ELSE '[]'::jsonb END
        ) LOOP
            IF v_field->>'required' = 'true'
                AND btrim(COALESCE(p_answers->>(v_field->>'id'), '')) = '' THEN
                RAISE EXCEPTION '필수 신청 항목을 입력해 주세요.' USING ERRCODE = '22023';
            END IF;
        END LOOP;
    ELSIF p_answers IS DISTINCT FROM '{}'::jsonb THEN
        RAISE EXCEPTION '설정되지 않은 신청 답변입니다.' USING ERRCODE = '22023';
    END IF;

    SELECT count(*) INTO v_join_count FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND status = 'JOIN';
    v_status := CASE WHEN v_session.capacity > 0 AND v_join_count >= v_session.capacity
        THEN 'WAITLIST' ELSE 'JOIN' END;
    INSERT INTO public.daily_program_session_responses (
        session_id, user_id, status, application_answers,
        application_form_revision, application_form_snapshot, application_audience, cancelled_at
    ) VALUES (
        p_session_id, p_user_id, v_status, COALESCE(p_answers, '{}'::jsonb),
        CASE WHEN v_program.application_form IS NULL THEN NULL ELSE v_program.application_form_revision END,
        v_program.application_form, p_audience, NULL
    ) ON CONFLICT(session_id,user_id) DO UPDATE SET
        status = EXCLUDED.status,
        application_answers = EXCLUDED.application_answers,
        application_form_revision = EXCLUDED.application_form_revision,
        application_form_snapshot = EXCLUDED.application_form_snapshot,
        application_audience = EXCLUDED.application_audience,
        cancelled_at = NULL,
        created_at = now();
    RETURN jsonb_build_object('status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.program_session_transition(uuid,uuid,text,text,jsonb)
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_program_session(
    p_session_id uuid, p_user_id uuid, p_action text, p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = p_user_id
            AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
            AND u.user_group IS DISTINCT FROM '게스트'
            AND u.user_group IS DISTINCT FROM 'STAFF'
            AND u.role IN ('student', 'user')
            AND u.status IS DISTINCT FROM 'withdrawn'
    ) THEN
        RAISE EXCEPTION '신청자 정보를 확인할 수 없습니다.' USING ERRCODE = '42501';
    END IF;
    RETURN public.program_session_transition(
        p_session_id, p_user_id, p_action, 'MEMBER', COALESCE(p_answers, '{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_program_session(uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_program_session(uuid,uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_program_session(
    p_session_id uuid, p_user_id uuid, p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    RETURN public.respond_to_program_session(p_session_id, p_user_id, p_action, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_program_session(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_program_session(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_guest_program_session(
    p_session_id uuid, p_user_id uuid, p_name text, p_phone text, p_birth text,
    p_answers jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = p_user_id
            AND u.user_group = '게스트' AND u.role IN ('student', 'user')
            AND u.status IS DISTINCT FROM 'withdrawn'
            AND btrim(u.name) = btrim(p_name) AND length(btrim(p_name)) > 0
            AND u.birth::text = p_birth AND p_birth ~ '^[0-9]{6}$'
            AND regexp_replace(u.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
            AND length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 11
    ) THEN
        RAISE EXCEPTION '게스트 신청자 정보를 확인할 수 없습니다.' USING ERRCODE = '42501';
    END IF;
    RETURN public.program_session_transition(
        p_session_id, p_user_id, 'JOIN', 'GUEST', COALESCE(p_answers, '{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb)
    TO anon, authenticated;

-- Preserve the four existing view columns; append answers for new clients.
CREATE OR REPLACE VIEW public.member_program_session_applications AS
    SELECT NULL::uuid AS session_id, NULL::uuid AS user_id,
        NULL::text AS action, NULL::text AS status,
        NULL::jsonb AS application_answers WHERE false;
CREATE OR REPLACE FUNCTION public.insert_member_program_session_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.status := public.respond_to_program_session(
        NEW.session_id, NEW.user_id, NEW.action,
        COALESCE(NEW.application_answers, '{}'::jsonb)
    )->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_member_program_session_application() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
COMMIT;
