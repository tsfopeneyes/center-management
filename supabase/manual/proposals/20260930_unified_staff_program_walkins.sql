-- REVIEW DRAFT. Extend the verified staff operation to recruiting challenges.
-- A staff walk-in deliberately bypasses required applicant answers and public
-- capacity, but records the form it bypassed for an auditable roster.
BEGIN;
CREATE OR REPLACE FUNCTION public.add_staff_program_walkins(p_notice_id bigint, p_user_ids uuid[])
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
    IF NOT FOUND OR v_notice.category <> 'PROGRAM'
        OR v_notice.is_recruiting IS DISTINCT FROM true
        OR v_notice.application_form IS NULL THEN
        RAISE EXCEPTION '모집 프로그램이 아닙니다.' USING ERRCODE = '23514';
    END IF;

    FOR v_user_id IN SELECT DISTINCT unnest(p_user_ids) AS id ORDER BY id LOOP
        SELECT status INTO v_status FROM public.notice_responses
            WHERE notice_id = p_notice_id AND user_id = v_user_id;
        IF v_status IS NULL THEN
            INSERT INTO public.notice_responses (
                notice_id, user_id, status, is_attended, application_answers,
                application_form_revision, application_form_snapshot
            ) VALUES (
                p_notice_id, v_user_id, 'JOIN', true, '{}'::jsonb,
                v_notice.application_form_revision, v_notice.application_form
            );
        ELSIF v_status = 'CANCELLED' THEN
            UPDATE public.notice_responses SET
                status = 'JOIN', is_attended = true, created_at = clock_timestamp(),
                cancelled_at = NULL, application_answers = '{}'::jsonb,
                application_form_revision = v_notice.application_form_revision,
                application_form_snapshot = v_notice.application_form
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
COMMIT;
