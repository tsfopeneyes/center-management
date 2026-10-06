-- REVIEW DRAFT. Do not apply to production before canonical form backfill,
-- optimistic revision endpoints, client cutover, and rollback impact checks.
BEGIN;

-- Whole-program and challenge applications use one locked response transition.
-- Challenge mission/reward policy remains outside this application boundary.
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
BEGIN
    IF p_action IS NULL OR p_action NOT IN ('JOIN', 'WAITLIST', 'CANCEL')
        OR p_audience IS NULL OR p_audience NOT IN ('MEMBER', 'GUEST') THEN
        RAISE EXCEPTION 'Invalid application action or audience' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_program FROM public.notices WHERE id = p_notice_id FOR UPDATE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.is_recruiting IS DISTINCT FROM true
        OR (v_program.is_challenge IS DISTINCT FROM true
            AND COALESCE(v_program.guest_properties->>'application_scope', 'PROGRAM') <> 'PROGRAM')
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
    IF v_program.is_challenge IS TRUE
        OR v_program.guest_properties->>'schedule_mode' = 'RECURRING' THEN
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
    IF public.program_application_audience_for_user(p_user_id) IS DISTINCT FROM p_audience THEN
        RAISE EXCEPTION '신청자 회원 구분을 확인해 주세요.' USING ERRCODE = '42501';
    END IF;
    IF v_program.application_form IS NULL THEN
        RAISE EXCEPTION '신청 질문 설정을 다시 확인해 주세요.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.validate_program_application_answers(
        v_program.application_form, p_audience, p_answers
    );

    SELECT count(*) INTO v_join_count FROM public.notice_responses
        WHERE notice_id = p_notice_id AND status = 'JOIN';
    v_status := CASE WHEN v_program.max_capacity > 0 AND v_join_count >= v_program.max_capacity
        THEN 'WAITLIST' ELSE 'JOIN' END;
    IF v_existing_status IS NULL THEN
        INSERT INTO public.notice_responses (
            notice_id, user_id, status, is_attended, application_answers,
            application_form_revision, application_form_snapshot, application_audience
        ) VALUES (
            p_notice_id, p_user_id, v_status, false, p_answers,
            v_program.application_form_revision, v_program.application_form, p_audience
        );
    ELSIF v_existing_status = 'CANCELLED' THEN
        UPDATE public.notice_responses SET
            status = v_status, is_attended = false, created_at = clock_timestamp(),
            cancelled_at = NULL, application_answers = p_answers,
            application_form_revision = v_program.application_form_revision,
            application_form_snapshot = v_program.application_form,
            application_audience = p_audience
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    ELSE
        RAISE EXCEPTION '기존 신청 상태를 관리자에게 확인해 주세요.' USING ERRCODE = '23514';
    END IF;
    RETURN jsonb_build_object('status', v_status);
END;
$$;

-- Staff cancellations use the same retained status history for ordinary and
-- challenge rosters. They remain allowed after the public deadline.
CREATE OR REPLACE FUNCTION public.cancel_program_application_by_staff(
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
    IF NOT FOUND OR v_program.category <> 'PROGRAM'
        OR v_program.is_recruiting IS DISTINCT FROM true THEN
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

-- Direct writes are no longer an alternate application transaction for any
-- recruiting program. Staff operations retain their separate verified path.
CREATE OR REPLACE FUNCTION public.notice_response_legacy_write_allowed(p_notice_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.notices n WHERE n.id = p_notice_id
            AND (n.category IS DISTINCT FROM 'PROGRAM' OR n.is_recruiting IS DISTINCT FROM true)
    )
$$;

CREATE FUNCTION public.respond_to_program_application_checked(
    p_notice_id bigint, p_user_id uuid, p_action text,
    p_answers jsonb, p_expected_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF p_action IS DISTINCT FROM 'CANCEL' THEN
        PERFORM public.assert_program_application_form_revision(p_notice_id,p_expected_revision);
    END IF;
    RETURN public.respond_to_program_application(
        p_notice_id,p_user_id,p_action,COALESCE(p_answers,'{}'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)
    TO authenticated;

CREATE VIEW public.member_program_application_checked_requests AS
    SELECT NULL::bigint AS notice_id, NULL::uuid AS user_id,
        NULL::text AS action, NULL::jsonb AS application_answers,
        NULL::integer AS expected_revision, NULL::text AS status WHERE false;
CREATE FUNCTION public.insert_member_program_application_checked_request()
RETURNS trigger LANGUAGE plpgsql SET search_path=public, pg_temp AS $$
BEGIN
    NEW.status := public.respond_to_program_application_checked(
        NEW.notice_id,NEW.user_id,NEW.action,
        COALESCE(NEW.application_answers,'{}'::jsonb),NEW.expected_revision
    )->>'status';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_member_program_application_checked_request()
    FROM PUBLIC;
CREATE TRIGGER member_program_application_checked_insert
    INSTEAD OF INSERT ON public.member_program_application_checked_requests
    FOR EACH ROW EXECUTE FUNCTION public.insert_member_program_application_checked_request();
REVOKE ALL ON public.member_program_application_checked_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.member_program_application_checked_requests TO authenticated;

COMMIT;
