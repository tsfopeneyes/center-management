-- REVIEW DRAFT. Shared by whole-program, challenge, and session request
-- endpoints. The lock prevents an admin edit between comparison and write.
BEGIN;
CREATE FUNCTION public.assert_program_application_form_revision(
    p_notice_id bigint, p_expected_revision integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_program public.notices%ROWTYPE;
BEGIN
    SELECT * INTO v_program FROM public.notices WHERE id=p_notice_id FOR UPDATE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.application_form IS NULL THEN
        RAISE EXCEPTION '신청 질문 설정을 다시 확인해 주세요.' USING ERRCODE='23514';
    END IF;
    IF p_expected_revision IS NULL
        OR p_expected_revision IS DISTINCT FROM v_program.application_form_revision THEN
        RAISE EXCEPTION '신청 질문이 변경되었습니다. 새로고침 후 다시 신청해 주세요.'
            USING ERRCODE='40001';
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_program_application_form_revision(bigint,integer)
    FROM PUBLIC, anon, authenticated;
COMMIT;
