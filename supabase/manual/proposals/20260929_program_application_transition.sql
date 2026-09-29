-- DRAFT ONLY. Requires 20260929_application_form_snapshots.sql,
-- 20260929_program_application_cancellation_history.sql, and a reviewed
-- direct-write policy cutover. Do not apply or expose questions on its own.
BEGIN;

CREATE OR REPLACE FUNCTION public.program_application_transition(
    p_notice_id bigint, p_user_id uuid, p_action text,
    p_audience text, p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
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
    -- One notice row serializes capacity decisions and cancellation promotion.
    SELECT * INTO v_program FROM public.notices WHERE id = p_notice_id FOR UPDATE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.is_recruiting IS DISTINCT FROM true
        OR v_program.is_challenge IS TRUE
        OR COALESCE(v_program.guest_properties->>'application_scope', 'PROGRAM') <> 'PROGRAM'
        OR v_program.program_status IN ('COMPLETED', 'CANCELLED')
        OR v_program.guest_properties->>'is_ended' = 'true'
        OR (p_audience = 'GUEST' AND v_program.guest_properties->>'allow_guest' = 'false') THEN
        RAISE EXCEPTION '프로그램 신청이 비활성화되어 있습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_program.is_leader_only IS TRUE AND (
        p_audience = 'GUEST' OR NOT EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.is_leader IS TRUE
        )
    ) THEN
        RAISE EXCEPTION '리더만 신청할 수 있는 프로그램입니다.' USING ERRCODE = '42501';
    END IF;
    IF v_program.recruitment_start_at IS NOT NULL THEN
        IF clock_timestamp() < v_program.recruitment_start_at THEN
            RAISE EXCEPTION '아직 모집 시작 전입니다.' USING ERRCODE = '23514';
        END IF;
        IF v_program.recruitment_deadline IS NULL
            OR v_program.recruitment_details_ready IS DISTINCT FROM true THEN
            RAISE EXCEPTION '프로그램 신청 정보를 확인해 주세요.' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF v_program.recruitment_deadline IS NOT NULL
        AND clock_timestamp() >= v_program.recruitment_deadline THEN
        RAISE EXCEPTION '신청 및 취소 기간이 종료되었습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_program.guest_properties->>'schedule_mode' = 'RECURRING' THEN
        IF v_program.program_end_date IS NOT NULL
            AND clock_timestamp() >= ((v_program.program_end_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') THEN
            RAISE EXCEPTION '프로그램이 종료되었습니다.' USING ERRCODE = '23514';
        END IF;
    ELSIF v_program.program_date IS NOT NULL AND clock_timestamp() >= v_program.program_date THEN
        RAISE EXCEPTION '프로그램이 종료되었습니다.' USING ERRCODE = '23514';
    END IF;

    SELECT status INTO v_existing_status FROM public.notice_responses
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    IF p_action = 'CANCEL' THEN
        IF v_existing_status IS NULL OR v_existing_status = 'CANCELLED' THEN
            RETURN jsonb_build_object('status', 'CANCELLED');
        END IF;
        UPDATE public.notice_responses
            SET status = 'CANCELLED', cancelled_at = clock_timestamp()
            WHERE notice_id = p_notice_id AND user_id = p_user_id;
        IF v_existing_status = 'JOIN' AND v_program.max_capacity > 0 THEN
            SELECT count(*) INTO v_join_count FROM public.notice_responses
                WHERE notice_id = p_notice_id AND status = 'JOIN';
            IF v_join_count < v_program.max_capacity THEN
                SELECT user_id INTO v_promote_user FROM public.notice_responses
                    WHERE notice_id = p_notice_id AND status = 'WAITLIST'
                    ORDER BY created_at, user_id LIMIT 1 FOR UPDATE;
                IF v_promote_user IS NOT NULL THEN
                    UPDATE public.notice_responses SET status = 'JOIN'
                        WHERE notice_id = p_notice_id AND user_id = v_promote_user;
                END IF;
            END IF;
        END IF;
        RETURN jsonb_build_object('status', 'CANCELLED');
    END IF;
    IF v_existing_status IN ('JOIN', 'WAITLIST') THEN
        RETURN jsonb_build_object('status', v_existing_status);
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

    SELECT count(*) INTO v_join_count FROM public.notice_responses
        WHERE notice_id = p_notice_id AND status = 'JOIN';
    v_status := CASE WHEN v_program.max_capacity > 0 AND v_join_count >= v_program.max_capacity
        THEN 'WAITLIST' ELSE 'JOIN' END;
    IF v_existing_status IS NULL THEN
        INSERT INTO public.notice_responses (
            notice_id, user_id, status, is_attended, application_answers,
            application_form_revision, application_form_snapshot
        ) VALUES (
            p_notice_id, p_user_id, v_status, false, COALESCE(p_answers, '{}'::jsonb),
            CASE WHEN v_program.application_form IS NULL THEN NULL ELSE v_program.application_form_revision END,
            v_program.application_form
        );
    ELSIF v_existing_status = 'CANCELLED' THEN
        -- The BEFORE UPDATE trigger archives the previous attempt first.
        UPDATE public.notice_responses SET
            status = v_status, is_attended = false, created_at = clock_timestamp(),
            cancelled_at = NULL, application_answers = COALESCE(p_answers, '{}'::jsonb),
            application_form_revision = CASE WHEN v_program.application_form IS NULL
                THEN NULL ELSE v_program.application_form_revision END,
            application_form_snapshot = v_program.application_form
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    ELSE
        RAISE EXCEPTION '기존 신청 상태를 관리자에게 확인해 주세요.' USING ERRCODE = '23514';
    END IF;
    RETURN jsonb_build_object('status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.program_application_transition(bigint,uuid,text,text,jsonb)
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_program_application(
    p_notice_id bigint, p_user_id uuid, p_action text,
    p_answers jsonb DEFAULT '{}'::jsonb
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
    RETURN public.program_application_transition(
        p_notice_id, p_user_id, p_action, 'MEMBER', COALESCE(p_answers, '{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_program_application(bigint,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_program_application(bigint,uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_guest_program_application(
    p_notice_id bigint, p_user_id uuid, p_name text, p_phone text, p_birth text,
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
    RETURN public.program_application_transition(
        p_notice_id, p_user_id, 'JOIN', 'GUEST', COALESCE(p_answers, '{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.apply_guest_program_application(bigint,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_guest_program_application(bigint,uuid,text,text,text,jsonb)
    TO anon, authenticated;

-- Staff removal is a separate action: unlike self-cancellation, staff may
-- correct a roster after the public recruitment deadline. Preserve the row
-- and use the same notice lock before promoting the oldest waitlisted user.
CREATE FUNCTION public.cancel_program_application_by_staff(
    p_notice_id bigint, p_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_program public.notices%ROWTYPE;
    v_status text;
    v_join_count integer;
    v_promote_user uuid;
BEGIN
    IF public.is_current_staff() IS DISTINCT FROM true THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_program FROM public.notices WHERE id = p_notice_id FOR UPDATE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.is_challenge IS TRUE THEN
        RAISE EXCEPTION '프로그램 신청이 아닙니다.' USING ERRCODE = '23514';
    END IF;
    SELECT status INTO v_status FROM public.notice_responses
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    IF v_status IS NULL OR v_status = 'CANCELLED' THEN
        RETURN jsonb_build_object('status', 'CANCELLED');
    END IF;
    UPDATE public.notice_responses SET status = 'CANCELLED', cancelled_at = clock_timestamp()
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    IF v_status = 'JOIN' AND v_program.max_capacity > 0 THEN
        SELECT count(*) INTO v_join_count FROM public.notice_responses
            WHERE notice_id = p_notice_id AND status = 'JOIN';
        IF v_join_count < v_program.max_capacity THEN
            SELECT user_id INTO v_promote_user FROM public.notice_responses
                WHERE notice_id = p_notice_id AND status = 'WAITLIST'
                ORDER BY created_at, user_id LIMIT 1 FOR UPDATE;
            IF v_promote_user IS NOT NULL THEN
                UPDATE public.notice_responses SET status = 'JOIN'
                    WHERE notice_id = p_notice_id AND user_id = v_promote_user;
            END IF;
        END IF;
    END IF;
    RETURN jsonb_build_object('status', 'CANCELLED');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_program_application_by_staff(bigint,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_program_application_by_staff(bigint,uuid) TO authenticated;

-- Both insert-only relations call the same verified transaction when an RPC
-- is absent from the PostgREST schema cache. They reveal no existing rows.
CREATE VIEW public.member_program_applications AS
    SELECT NULL::bigint AS notice_id, NULL::uuid AS user_id,
        NULL::text AS action, NULL::jsonb AS application_answers,
        NULL::text AS status WHERE false;
CREATE FUNCTION public.insert_member_program_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.status := public.respond_to_program_application(
        NEW.notice_id, NEW.user_id, NEW.action,
        COALESCE(NEW.application_answers, '{}'::jsonb)
    )->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_member_program_application() FROM PUBLIC;
CREATE TRIGGER member_program_application_insert
    INSTEAD OF INSERT ON public.member_program_applications
    FOR EACH ROW EXECUTE FUNCTION public.insert_member_program_application();
REVOKE ALL ON public.member_program_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.member_program_applications TO authenticated;

CREATE VIEW public.guest_program_applications AS
    SELECT NULL::bigint AS notice_id, NULL::uuid AS user_id,
        NULL::text AS name, NULL::text AS phone, NULL::text AS birth,
        NULL::jsonb AS application_answers, NULL::text AS status WHERE false;
CREATE FUNCTION public.insert_guest_program_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.status := public.apply_guest_program_application(
        NEW.notice_id, NEW.user_id, NEW.name, NEW.phone, NEW.birth,
        COALESCE(NEW.application_answers, '{}'::jsonb)
    )->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_guest_program_application() FROM PUBLIC;
CREATE TRIGGER guest_program_application_insert
    INSTEAD OF INSERT ON public.guest_program_applications
    FOR EACH ROW EXECUTE FUNCTION public.insert_guest_program_application();
REVOKE ALL ON public.guest_program_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.guest_program_applications TO anon, authenticated;

CREATE VIEW public.staff_program_application_cancellations AS
    SELECT NULL::bigint AS notice_id, NULL::uuid AS user_id,
        NULL::text AS status WHERE false;
CREATE FUNCTION public.insert_staff_program_application_cancellation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.status := public.cancel_program_application_by_staff(NEW.notice_id, NEW.user_id)->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_staff_program_application_cancellation() FROM PUBLIC;
CREATE TRIGGER staff_program_application_cancellation_insert
    INSTEAD OF INSERT ON public.staff_program_application_cancellations
    FOR EACH ROW EXECUTE FUNCTION public.insert_staff_program_application_cancellation();
REVOKE ALL ON public.staff_program_application_cancellations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.staff_program_application_cancellations TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
