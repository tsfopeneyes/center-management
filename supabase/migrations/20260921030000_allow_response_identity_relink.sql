BEGIN;

CREATE OR REPLACE FUNCTION public.guard_program_recruitment_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    program public.notices%ROWTYPE;
    check_time timestamptz;
BEGIN
    -- Updates that preserve the application itself (program and status) do not
    -- represent an application or cancellation. Account merges may therefore
    -- relink user_id without reopening a completed recruitment period.
    IF TG_OP = 'UPDATE'
        AND NEW.status IS NOT DISTINCT FROM OLD.status
        AND NEW.notice_id IS NOT DISTINCT FROM OLD.notice_id THEN RETURN NEW; END IF;
    IF TG_OP <> 'DELETE' AND NEW.status NOT IN ('JOIN', 'WAITLIST') THEN RETURN NEW; END IF;

    SELECT * INTO program FROM public.notices
        WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.notice_id ELSE NEW.notice_id END FOR SHARE;
    IF NOT FOUND OR program.category <> 'PROGRAM' OR program.is_recruiting IS DISTINCT FROM true
        OR program.recruitment_start_at IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    IF auth.role() = 'service_role' OR public.calendar_is_admin() THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    check_time := clock_timestamp();
    IF check_time < program.recruitment_start_at THEN
        RAISE EXCEPTION '아직 모집 시작 전입니다.' USING ERRCODE = '23514';
    END IF;
    IF program.recruitment_deadline IS NULL OR check_time >= program.recruitment_deadline
        OR program.program_status IN ('COMPLETED', 'CANCELLED')
        OR coalesce((program.guest_properties->>'is_ended')::boolean, (to_jsonb(program)->>'is_ended')::boolean, false) THEN
        RAISE EXCEPTION '신청 및 취소 기간이 종료되었습니다.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP <> 'DELETE' AND program.recruitment_details_ready IS DISTINCT FROM true THEN
        RAISE EXCEPTION '상세 정보 준비 중입니다.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

COMMIT;
